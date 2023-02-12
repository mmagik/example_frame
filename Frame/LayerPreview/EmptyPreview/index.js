
import React from "react"

import { getLayerTitle } from "../../../../Project/ProjectEditor/Scene/SceneObjects/Scene"

import "./EmptyPreview.css"

const EmptyPreview = props => {

    const preview = getLayerTitle(props.layerId) || props.title

    return <div class="tl-empty-preview">
        {preview}
    </div>
}


export default EmptyPreview