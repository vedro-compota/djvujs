"use strict";

/**
 * Скрипт для тестирования библиотеки непосредственно в синхронном режиме
 */

DjVu.IS_DEBUG = true;

var fileSize = 0;
var output;
var djvuArrayBuffer;
var timeOutput = document.querySelector('#time_output');
var rerunButton = document.querySelector('#rerun');
rerunButton.onclick = rerun;
var pageNumber = 0;
var djvuUrl = 'assets/colorbook.djvu';

function saveStringAsFile(string) {
    var link = document.createElement('a');
    link.download = 'string.txt';
    var blob = new Blob([string], { type: 'text/plain' });
    link.href = window.URL.createObjectURL(blob);
    link.click();
}

function rerun() {
    Globals.init();
    Globals.clearCanvas();

    setTimeout(() => {
        var start = performance.now();
        readDjvu(djvuArrayBuffer);
        var time = performance.now() - start;
        timeOutput.innerText = Math.round(time);
    }, 0);
}

window.onload = function () {
    output = document.getElementById("output");
    Globals.init();
    // testFunc();
    loadDjVu();
    //loadPicture(); 
}

function loadDjVu() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", djvuUrl);
    xhr.responseType = "arraybuffer";
    xhr.onload = function (e) {
        console.log(e.loaded);
        fileSize = e.loaded;
        djvuArrayBuffer = xhr.response;
        rerun();
        //splitDjvu(buf);
    }
    xhr.send();
}

function loadPicture() {
    Globals.loadFile('samples/csl.djvu').then(buffer => {
        readDjvu(buffer);
    });
}

function readPicture(buffer) {

    createImageBitmap(new Blob([buffer])).then(function (image) {
        var pictureTotalTime = performance.now();
        var canvas = document.getElementById('canvas2');
        var c = canvas.getContext('2d');
        canvas.width = image.width;
        canvas.height = image.height;

        c.drawImage(image, 0, 0);
        var imageData = c.getImageData(0, 0, image.width, image.height);
        var iwiw = new IWImageWriter(90, 0, 1);
        // var doc = iwiw.createMultyPageDocument([imageData, imageData, imageData]);
        iwiw.startMultyPageDocument();
        iwiw.addPageToDocument(imageData);
        //for (var i = 0; i < 5; i++) 
        var buffer = iwiw.endMultyPageDocument();
        //var doc = new DjVuDocument(buffer);
        // var doc = iwiw.createOnePageDocument(imageData);
        console.log('docCreateTime = ', performance.now() - pictureTotalTime);
        var link = document.querySelector('#dochref');
        link.href = DjVuWorker.createArrayBufferURL(buffer);

        // c.putImageData(doc.pages[0].getImage(), 0, 0);
        console.log('Counter', Globals.counter);
        //console.log('PZP', Globals.pzp.log.length, ' ', Globals.pzp.offset );
        // writeln(doc.toString());
        console.log('pictureTotalTime = ', performance.now() - pictureTotalTime);
    });
}

function readDjvu(buf) {
    var link = document.querySelector('#dochref');
    var time = performance.now();
    console.log("Buffer length = " + buf.byteLength);
    var doc = new DjVuDocument(buf);
    Globals.counter = 0;

    console.log('Before render');
    Globals.drawImage(doc.pages[pageNumber].getImageData(), doc.pages[pageNumber].dpi * 1);
    console.log(doc.pages[pageNumber].getText());
    //saveStringAsFile(doc.pages[pageNumber].getText());
    // writeln(doc.toString(true));
    // doc.countFiles();
    console.log(Globals.Timer.toString());
    console.log("Total execution time = ", performance.now() - time);
}

function splitDjvu(buf) {
    var link = document.querySelector('#dochref');
    console.log("Buffer length = " + buf.byteLength);
    var doc = new DjVuDocument(buf);
    var slice = doc.slice(0, 11);
    link.href = slice.createObjectURL();
}

/**
 * Функция для работы с файлами загруженными вручную.
 */
function main(files) {
    clear();
    console.log(files.length);
    //readFile(file);
    var fileReader = new FileReader();
    var doc1, doc2;
    fileReader.onload = function () {
        if (!doc1) {
            doc1 = new DjVuDocument(this.result);
            fileReader.readAsArrayBuffer(files[1]);
            return;
        }

        doc2 = new DjVuDocument(this.result);
        testFunc(doc1, doc2);

    };
    if (files.length > 0) {
        fileReader.readAsArrayBuffer(files[0]);
    }
}

function testFunc(doc1, doc2) {
    var doc = DjVuDocument.concat(doc1, doc2);
    Globals.drawImageSmooth(doc.pages[0].getImage(), 600);
    writeln(doc.toString());
    var link = document.querySelector('#dochref');
    link.href = doc.createObjectURL();
}
