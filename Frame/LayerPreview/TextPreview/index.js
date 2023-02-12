
import React from "react"

import { getLayerTitle } from "../../../../Project/ProjectEditor/Scene/SceneObjects/Scene"
import TextSmall from "../../../../svg/TextSmall"

import "./TextPreview.css"


const TextPreview = props => {

    const preview = getLayerTitle(props.layerId)

    return <div class="tl-text-preview">
        <div className="tl-text-icon"><TextSmall color="#ffffff" /></div>
        <span>{preview}</span>
    </div>
}


export default TextPreview