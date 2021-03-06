import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Consts from '../constants/consts';

const DEFAULT_DPI = 100;

class ImageBlock extends React.Component {

    static propTypes = {
        imageWidth: PropTypes.number,
        imageHeight: PropTypes.number,
        imageData: PropTypes.object,
        imageDPI: PropTypes.number,
        imageUrl: PropTypes.string
    };

    constructor(props) {
        super(props);
        this.tmpCanvas = document.createElement('canvas');
        this.tmpCanvasCtx = this.tmpCanvas.getContext('2d');
    }

    componentDidUpdate() {
        this.updateImageIfRequired();
    }

    componentDidMount() {
        this.updateImageIfRequired();
    }

    getScaledImageWidth() {
        if (this.props.imageDPI) {
            const stdScale = this.props.imageDPI ? this.props.imageDPI / DEFAULT_DPI : 1
            return this.props.imageWidth / stdScale * this.props.userScale;
        } else {
            return null;
        }
    }

    updateImageIfRequired() {
        if (!(this.canvas && this.props.imageData) && !(this.img && this.props.dataUrl)) {
            return;
        }
        if (!this.props.dataUrl && this.props.imageData) {
            this.drawImageOnCanvas();
        } else {
            this.canvas.height = this.canvas.width = 0;
        }
    }

    drawImageOnCanvas() {
        const { imageData, imageDPI, userScale } = this.props;

        var image = imageData.a;
        var scale = imageDPI ? imageDPI / DEFAULT_DPI : 1;
        scale /= userScale

        this.stdWidth = image.width / scale * userScale;
        this.stdHeight = image.height / scale * userScale;

        this.tmpCanvas.width = image.width;
        this.tmpCanvas.height = image.height;
        this.tmpCanvasCtx.putImageData(image, 0, 0);

        var tmpH, tmpW, tmpH2, tmpW2;
        tmpH = tmpH2 = this.tmpCanvas.height;
        tmpW = tmpW2 = this.tmpCanvas.width;

        if (scale > 4) {
            tmpH = this.tmpCanvas.height / scale * 4;
            tmpW = this.tmpCanvas.width / scale * 4;
            //первое сжатие
            this.tmpCanvasCtx.drawImage(this.tmpCanvas, 0, 0, tmpW, tmpH);
        }
        if (scale > 2) {
            tmpH2 = this.tmpCanvas.height / scale * 2;
            tmpW2 = this.tmpCanvas.width / scale * 2;
            //второе сжатие
            this.tmpCanvasCtx.drawImage(this.tmpCanvas, 0, 0, tmpW, tmpH, 0, 0, tmpW2, tmpH2);
        }
        //итоговое сжатие
        this.canvas.width = image.width / scale;
        this.canvas.height = image.height / scale;
        this.canvasCtx.drawImage(this.tmpCanvas, 0, 0, tmpW2, tmpH2,
            0, 0, this.canvas.width, this.canvas.height);
        this.tmpCanvas.width = this.tmpCanvas.height = 0;
    }

    canvasRef = (node) => {
        this.canvas = node;
        if (this.canvas) {
            this.canvasCtx = this.canvas.getContext('2d');
        }
    };

    render() {
        const isCanvasMode = !this.props.dataUrl;
        return (
            <div className="image_wrapper">
                <img
                    style={isCanvasMode ? { display: 'none' } : null}
                    className="image"
                    width={this.getScaledImageWidth()}
                    ref={node => this.img = node}
                    src={this.props.dataUrl}
                    alt='Djvu Viewer'
                />
                <canvas
                    style={isCanvasMode ? null : { display: 'none' }}
                    ref={this.canvasRef}
                    className="image"
                />
            </div>
        );
    }
}

export default connect(
    state => ({
        imageWidth: state.imageWidth,
        imageHeight: state.imageHeight,
        imageData: state.imageData,
        dataUrl: state.dataUrl,
        imageDPI: state.imageDPI,
        userScale: state.userScale
    })
)(ImageBlock);