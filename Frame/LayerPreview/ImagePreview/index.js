
import React from "react"

import { getLayerTitle, getLayerPreview } from "../../../../Project/ProjectEditor/Scene/SceneObjects/Scene"
import EmptyPreview from "../EmptyPreview/"

import "./ImagePreview.css"


const ImagePreview = props => {
    const preview = getLayerPreview(props.layerId)

    if (!preview) {
        return <EmptyPreview layerId={props.layerId} title="Image" />
    }

    const style = preview 
        ? {
            backgroundImage: `url(${preview})`
        }
        : {}

    return <div class="tl-image-preview" style={style}>
        
    </div>
}


export default ImagePreview