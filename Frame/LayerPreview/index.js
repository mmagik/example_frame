
import React from "react"
import { ITEM_TYPES } from "../../../Project/ProjectEditor/Scene/constants"
import TextPreview from "./TextPreview/"
import VideoPreview from "./VideoPreview/"
import ImagePreview from "./ImagePreview/"
import MovinPreview from "./MovinPreview/"
import GraphicsPreview from "./GraphicsPreview/"
import SVGPreview from "./SVGPreview/"
import GenerativePreview from "./GenerativePreview/"
import AudioPreview from "./AudioPreview/"
import EmptyPreview from "./EmptyPreview/"

const PREVIEW_TYPES = {
    TEXT: "text",
    IMAGE: "image",
    MP4VIDEO: "mp4video",
    WEBMVIDEO: "webmvideo",
    SVG: "svg",
    MOVIN: "movin",
    GRAPHICS: "graphics",
    ASPRITE: "asprite",
    AUDIO: "audio",
    GENERATIVE: "generative",
}


class LayerPreview extends React.Component {



    get layerState() {
        return this.props.layerState
    }
    get layerId() {
        return this.layerState.id
    }
    get info() {
        return this.layerState.info
    }
    get previewType() {
        const { layerState } = this
        const { info } = layerState

        if (layerState.layerType === "soundtrack") {
            return PREVIEW_TYPES.AUDIO
        }

        if (layerState.items.find(item => item.type === ITEM_TYPES.TEXT && !item.isMaskItem)) {
            return PREVIEW_TYPES.TEXT
        }
        
        return info && info.previewType ? info.previewType : null
    }


    renderPreview() {
        const { previewType } = this

        if (previewType === PREVIEW_TYPES.TEXT) {
            return <TextPreview layerId={this.layerId} />
        } else if (previewType === PREVIEW_TYPES.MP4VIDEO || previewType === PREVIEW_TYPES.WEBMVIDEO) {
            return <VideoPreview 
                layerState={this.layerState} 
                frameIndex={this.props.frameStart} 
                layerIndex={this.props.layerIndex} 
                layerBounds={this.props.layerBounds}
                tempOffsetStart={this.props.tempOffsetStart} 
            />
        } else if (previewType === PREVIEW_TYPES.IMAGE) {
            return <ImagePreview layerId={this.layerId} />
        } else if (previewType === PREVIEW_TYPES.GRAPHICS) {
            return <GraphicsPreview layerId={this.layerId} />
        } else if (previewType === PREVIEW_TYPES.SVG) {
            return <SVGPreview layerId={this.layerId} />
        } else if (previewType === PREVIEW_TYPES.MOVIN) {
            return <MovinPreview 
                layerState={this.layerState} 
            />
        } else if (previewType === PREVIEW_TYPES.GENERATIVE) {
            return <GenerativePreview layerId={this.layerId} />
        } else if (previewType === PREVIEW_TYPES.ASPRITE) {
            // console.log("preview:ASPRITE")
            return <VideoPreview 
                layerState={this.layerState} 
                frameIndex={this.props.frameStart} 
                layerIndex={this.props.layerIndex} 
                layerBounds={this.props.layerBounds}
                tempOffsetStart={this.props.tempOffsetStart}
                isAnimatedSprite={true}
            />
        } else if (previewType === PREVIEW_TYPES.AUDIO) {
            return <AudioPreview 
                layerState={this.layerState} 
                frameIndex={this.props.frameStart} 
                layerIndex={this.props.layerIndex}
                layerBounds={this.props.layerBounds}
                tempOffsetStart={this.props.tempOffsetStart}
            />
        }

        return <EmptyPreview layerId={this.layerId} title="Layer" />
    }


    render() {

        return this.renderPreview()
    }
}



export default LayerPreview
