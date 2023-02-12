
import React from "react"

import { getLayerTitle, getLayerPreview } from "../../../../Project/ProjectEditor/Scene/SceneObjects/Scene"
import EmptyPreview from "../EmptyPreview/"

import "./GenerativePreview.css"


const GenerativePreview = props => {
    const preview = getLayerPreview(props.layerId)

    if (!preview) {
        return <EmptyPreview layerId={props.layerId} title="Image" />
    }

    const title = getLayerTitle(props.layerId)

    const style = preview 
        ? {
            backgroundImage: `url(${preview})`
        }
        : {}

    return <div class="tl-gen-preview" style={style}>
        <div className="tl-gen-title">
            {title}
        </div>
    </div>
}


export default GenerativePreview