
import React from "react"

import { getLayerTitle } from "../../../../Project/ProjectEditor/Scene/SceneObjects/Scene"

import "./MovinPreview.css"


function getPreviewUrl(layerState) {
    if (!layerState.info || !layerState.info.stripe) return null
    const { stripe } = layerState.info
    return `${stripe.dir}/${stripe.fileId}.${stripe.formats[0]}`
}


const MovinPreview = props => {

    const layerId = props.layerState.id
    // console.log(props.layerState)
    // const preview = getLayerPreview(props.layerId)

    const previewUrl = getPreviewUrl(props.layerState)
    const title = getLayerTitle(layerId)

    const style = previewUrl 
    ? {
        backgroundImage: `url(${previewUrl})`
    }
    : {}

    return <div class="tl-movin-preview" style={style}>
        <div className="tl-movin-title">{title}</div>
    </div>
}


export default MovinPreview