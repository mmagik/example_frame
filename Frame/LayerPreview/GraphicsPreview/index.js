
import React from "react"

import { getLayerTitle, getLayerPreview } from "../../../../Project/ProjectEditor/Scene/SceneObjects/Scene"

import "./GraphicsPreview.css"


const GraphicsPreview = props => {

    const preview = getLayerPreview(props.layerId)
    const title = getLayerTitle(props.layerId)

    const style = preview 
        ? {
            backgroundImage: `url(${preview})`
        }
        : {}

    return <div class="tl-graphics-preview" style={style}>
        <div className="tl-graphics-title">
            {title}
        </div>
    </div>
}


export default GraphicsPreview