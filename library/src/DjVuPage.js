'use strict';

/**
 * Страница документа
 */
class DjVuPage {
    /**
     * Принимает байтовый поток и id из машинного оглавления документа. 
     */
    constructor(bs, dirmID, getINCLChunkCallback) {
        this.id = "FORM:DJVU"; // данная информация была проверена в DjVuDocument
        this.length = bs.length - 8;
        this.dirmID = dirmID; // нужно для метаданных
        this.bs = bs;
        this.bs.jump(12);
        this.djbz = null;
        this.bg44arr = new Array();
        this.fg44 = null;
        this.getINCLChunkCallback = getINCLChunkCallback; // метод для получения глобальной порции данных (словарь обычно) от документа по id
        /**
         * @type {IWImage}
         */
        this.bgimage = null;
        /**
         * @type {IWImage}
         */
        this.fgimage = null;
        /**
         * @type {JB2Image}
         */
        this.sjbz = null;
        /**
         * @type {DjvuPallete}
         */
        this.fgbz = null;

        /** @type {DjvuText} */
        this.text = null;

        this.decoded = false;
        this.info = null;


        // список всех порций данных - для toString
        this.iffchunks = [];
        // id разделяемых данных (в частности словарей)
        this.dependencies = null;
        //this.init();
    }

    /**
     * Свойство необходимое для корректного отображения страницы - влияет на 100% масштаб.
     */
    get dpi() {
        return this.info ? this.info.dpi : undefined;
    }

    // метод поиска зависимостей, то есть INCLChunk
    // возвращает массив id 
    getDependencies() {
        //чтобы не вызывалось более 1 раза
        if (this.info || this.dependencies) {
            return this.dependencies;
        }
        this.dependencies = [];
        var bs = this.bs.fork();
        while (!bs.isEmpty()) {
            var chunk;
            var id = bs.readStr4();
            var length = bs.getInt32();
            bs.jump(-8);
            // вернулись назад
            var chunkBs = bs.fork(length + 8);
            bs.jump(8 + length + (length & 1 ? 1 : 0));
            // перепрыгнули к следующей порции
            if (id === "INCL") {
                chunk = new INCLChunk(chunkBs);
                this.dependencies.push(chunk.ref);
            }
        }
        return this.dependencies;
    }

    /**
     * Метод предварительного разбора страницы.
     * Вызывается вручную или автоматически
     * @returns {DjVuPage}
     */
    init() {
        //чтобы не вызывалось более 1 раза
        if (this.info) {
            return this;
        }
        this.dependencies = [];
        this.info = new INFOChunk(this.bs.fork(18));
        this.bs.jump(18);
        this.iffchunks.push(this.info);
        while (!this.bs.isEmpty()) {
            var chunk;
            var id = this.bs.readStr4();
            var length = this.bs.getInt32();

            this.bs.jump(-8); // вернулись назад
            var chunkBs = this.bs.fork(length + 8); // создали поток включающий только 1 порцию
            this.bs.jump(8 + length + (length & 1 ? 1 : 0)); // перепрыгнули к следующей порции

            if (id == "FG44") {
                chunk = this.fg44 = new ColorChunk(chunkBs);
            } else if (id == "BG44") {
                this.bg44arr.push(chunk = new ColorChunk(chunkBs));
            } else if (id == 'Sjbz') {
                chunk = this.sjbz = new JB2Image(chunkBs);
            } else if (id === "INCL") {
                chunk = this.incl = new INCLChunk(chunkBs);
                var inclChunk = this.getINCLChunkCallback(this.incl.ref);
                inclChunk.id === "Djbz" ? this.djbz = inclChunk : this.iffchunks.push(inclChunk);
                this.dependencies.push(chunk.ref);
            } else if (id === "CIDa") {
                chunk = new CIDaChunk(chunkBs);
            } else if (id === 'Djbz') {
                chunk = this.djbz = new JB2Dict(chunkBs);
            } else if (id === 'FGbz') {
                chunk = this.fgbz = new DjVuPalette(chunkBs);
            } else if (id === 'TXTa' || id === 'TXTz') {
                chunk = this.text = new DjVuText(chunkBs);
            } else {
                chunk = new IFFChunk(chunkBs);
            }
            //тут все порции в том порядке, в каком встретились при разборе 
            this.iffchunks.push(chunk);
        }
        return this;
    }

    /**
     * Метод генерации изображения для общего случая (все 3 слоя)
     * @returns {ImageData}
     */
    getImageData() {
        this.decode();
        var time = performance.now();
        //достаем маску
        if (!this.sjbz) {
            //если только фоновый слой
            if (this.bgimage) {
                return this.bgimage.getImage();
            }//это вряд ли может быть но на всякий случай   
            else if (this.fgimage) {
                return this.fgimage.getImage();
            } else {
                return null;
            }
        }
        if (!this.bgimage && !this.fgimage) {
            return this.sjbz.getImage(this.fgbz);
        }

        var fgscale, bgscale, fgpixelmap, bgpixelmap;

        if (this.bgimage) {
            //масштабы на случай если закодированы в более меньшем разрешении
            bgscale = Math.round(this.info.width / this.bgimage.info.width);
            bgpixelmap = this.bgimage.pixelmap;
        } else {
            bgscale = 1;
            var whitePixel = { r: 255, g: 255, b: 255 };
            bgpixelmap = {
                getPixel() {
                    return whitePixel;
                }
            }
        }

        if (this.fgimage) {
            //масштабы на случай если закодированы в более меньшем разрешении
            fgscale = Math.round(this.info.width / this.fgimage.info.width);
            fgpixelmap = this.fgimage.pixelmap;
        } else {
            fgscale = 1;
            var blackPixel = { r: 0, g: 0, b: 0 };
            fgpixelmap = {
                getPixel() {
                    return blackPixel;
                }
            }
        }


        var image;
        if (!this.fgbz) { // если нет палитры
            image = this.createImageFromMaskImageAndPixelMaps(
                this.sjbz.getMaskImage(),
                fgpixelmap,
                bgpixelmap,
                fgscale,
                bgscale
            );
        } else { // тут уже предполагается, что переднего плана нет, а только палитра
            image = this.createImageFromMaskImageAndBackgroundPixelMap(
                this.sjbz.getImage(this.fgbz, true),
                bgpixelmap,
                bgscale
            );
        }

        DjVu.IS_DEBUG && console.log("DataImage creating time = ", performance.now() - time);
        return image;
    }

    createImageFromMaskImageAndPixelMaps(maskImage, fgpixelmap, bgpixelmap, fgscale, bgscale) {
        var image = maskImage;
        var pixelArray = image.data;
        //набираем изображение по пикселям
        for (var i = 0; i < this.info.height; i++) {
            for (var j = 0; j < this.info.width; j++) {
                var pixel;
                var index = ((this.info.height - i - 1) * this.info.width + j) << 2;
                if (pixelArray[index]) {
                    var is = Math.floor(i / bgscale);
                    var js = Math.floor(j / bgscale);
                    pixel = bgpixelmap.getPixel(is, js);
                } else {
                    var is = Math.floor(i / fgscale);
                    var js = Math.floor(j / fgscale);
                    pixel = fgpixelmap.getPixel(is, js);
                }

                pixelArray[index] = pixel.r;
                pixelArray[index + 1] = pixel.g;
                pixelArray[index + 2] = pixel.b;
                //pixelArray[index + 3] = 255; уже сделано при создании изображения
            }
        }

        return image;
    }

    createImageFromMaskImageAndBackgroundPixelMap(maskImage, bgpixelmap, bgscale) {
        var pixelArray = maskImage.data;
        var pixel;
        //набираем изображение по пикселям
        for (var i = 0; i < this.info.height; i++) {
            for (var j = 0; j < this.info.width; j++) {
                var index = ((this.info.height - i - 1) * this.info.width + j) * 4;
                if (pixelArray[index + 3]) {
                    var is = Math.floor(i / bgscale);
                    var js = Math.floor(j / bgscale);
                    pixel = bgpixelmap.getPixel(is, js);
                    pixelArray[index] = pixel.r;
                    pixelArray[index + 1] = pixel.g;
                    pixelArray[index + 2] = pixel.b;
                } else {
                    pixelArray[index + 3] = 255;
                }
            }
        }

        return maskImage;
    }

    /**
     * Раскодирование всех 3 слоев изображения страницы, вызыват init()
     * @returns {DjVuPage}
     */
    decode() {
        if (this.decoded) {
            return this;
        }
        this.init();
        var time = performance.now();
        this.sjbz ? this.sjbz.decode(this.djbz) : 0;
        DjVu.IS_DEBUG && console.log("Mask decoding time = ", performance.now() - time);
        time = performance.now();
        if (this.bg44arr.length) {
            this.bgimage = new IWImage();
            this.bg44arr.forEach((chunk) => {
                var zp = new ZPDecoder(chunk.bs);
                this.bgimage.decodeChunk(zp, chunk.header);
            }
            );
            this.bgimage.createPixelmap();
        }
        DjVu.IS_DEBUG && console.log("Background decoding time = ", performance.now() - time);
        time = performance.now();
        if (this.fg44) {
            this.fgimage = new IWImage();
            let zp = new ZPDecoder(this.fg44.bs);
            this.fgimage.decodeChunk(zp, this.fg44.header);
            this.fgimage.createPixelmap();
        }
        DjVu.IS_DEBUG && console.log("Foreground decoding time = ", performance.now() - time);
        this.decoded = true;
        return this;
    }

    /**
     * Фоновой слой
     * @returns {ImageData}
     */
    getBackgroundImageData() {
        this.decode();
        if (this.bg44arr.length) {
            this.bg44arr.forEach((chunk) => {
                let zp = new ZPDecoder(chunk.bs);
                this.bgimage.decodeChunk(zp, chunk.header);
            }
            );
            return this.bgimage.getImage();
        } else {
            return null;
        }
    }

    /**
     * @returns {ImageData}
     */
    getForegroundImageData() {
        this.decode();
        if (this.fg44) {
            this.fgimage = new IWImage();
            let zp = new ZPDecoder(this.fg44.bs);
            this.fgimage.decodeChunk(zp, this.fg44.header);
            return this.fgimage.getImage();
        } else {
            return null;
        }
    }

    /** @return {ImageData} */
    getMaskImageData() {
        this.decode();
        return this.sjbz && this.sjbz.getImage(this.fgbz);
    }

    getText() {
        this.decode();
        if (this.text) {
            return this.text.getText();
        } else {
            return "";
        }
    }

    toString() {
        var str = '[DirmID: "' + this.dirmID + '"]\n';
        str += this.id + ' ' + this.length + "\n";
        this.init();
        for (var i = 0; i < this.iffchunks.length; i++) {
            str += this.iffchunks[i].toString();
        }
        return str + '\n';
    }
}
