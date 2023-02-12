
import React from "react"

import { getLayerTitle, getLayerPreview } from "../../../../Project/ProjectEditor/Scene/SceneObjects/Scene"

import "./SVGPreview.css"


const SVGPreview = props => {

    const preview = getLayerPreview(props.layerId)
    const title = getLayerTitle(props.layerId)

    const style = preview 
        ? {
            backgroundImage: `url(${preview})`
        }
        : {}

    return <div class="tl-svg-preview" style={style}>
        <div className="tl-svg-title">
            {title}
        </div>
    </div>
}


export default SVGPreview