
import React from "react"
import { connect } from "react-redux"

import { setEditorData } from "../../../../actions/editor"
import { setElementStyles } from "../../../../actions/elements"
// import { getResource } from "../../../Project/ProjectEditor/Scene/ResourcesManager/"
import { getLayerLoadingData } from "../../../Project/ProjectEditor/Scene/SceneObjects/SceneLayer"
import { ITEM_TYPES } from "../../../Project/ProjectEditor/Scene/constants"
import secondsToTime from "../../../helpers/secondsToTime"

import LayerPreview from "../LayerPreview/"
import SlideToolAction from "./SlideToolAction/"
// import AudioEditor from "./AudioEditor/"

import Lock from "../../../svg/Lock"
// import TextSmall from "../../../svg/TextSmall"
import EyeClosed from "../../../svg/EyeClosed"

// import secondsToPixels from "../helpers/secondsToPixels"
// import layerStartPx from "../helpers/layerStartPx"

import "./Layer.css"


const AUDIO_LAYER_TYPE = "soundtrack"
const CAN_SLIDE_ITEM_TYPES = [
    ITEM_TYPES.MP4VIDEO,
    ITEM_TYPES.WEBMVIDEO
]


const Loading = ({ progress = 0, error, title = "Loading", width }) => {
    const style = {
        width: `${progress}%`
    }
    const __progress = +progress

    if (error) {
        return <div className="t-layer-loading">Loading Error</div>
    }

    return <div className="t-layer-loading">
        {width > 50 && title} {Boolean(__progress) && `${parseInt(__progress)} %`}
        <span style={style}></span>
    </div>
}



class Layer extends React.Component {

    static mapStateToProps = state => {
        return {
            timeScale: state.timeScale,
            elements: state.elements,
            editor: state.editor
        }
    }

    static mapDispatchToProps = (dispatch) => ({
        onSetEditorData(params) {
            dispatch(setEditorData(params))
        },
        onSetElementStyles(sceneType, frameIndex, layerId, selector, styles, needUpdate) {
            dispatch(setElementStyles({
                sceneType, frameIndex, layerId, selector, styles, needUpdate
            }))
        },
    })

    // get scaleLeftMargin() {
    //     return this.props.timeScale.scaleLeftMargin
    // }

    get slideTool() {
        return this.props.editor.slideTool
    }

    get audioMode() {
        return this.props.editor.audioMode
    }

    get frameIndex() {
        return this.props.frameIndex
    }
    get sceneIndex() {
        return this.props.sceneIndex
    }
    get sceneType() {
        return this.props.sceneType
    }

    get layer() {
        return this.props.layer
    }

    get frameStart() {
        return this.props.frameStart
    }


    // # Состояние слоя из elementsState
    get layerState() {
        const { frameIndex, sceneIndex } = this
        const scene = this.props.elements[sceneIndex]
        const frame = scene.frames[frameIndex]
        return frame.children[this.props.index]
    }
    get layerId() {
        return this.layerState.id
    }

    get isAudio() {
        const { layerState } = this
        return layerState && layerState.layerType === AUDIO_LAYER_TYPE
    }

    get hideLayer() {
        const { layerState } = this
        if (!layerState) return null
        return layerState.itemsContainer && layerState.itemsContainer.hideLayer
    }


    get locked() {
        const { layerState } = this
        if (!layerState) return null
        return layerState.itemsContainer && layerState.itemsContainer.disabledInteractivity
    }

    get bounds() {
        return this.layer.bounds
    }

    get x() {
        return this.layer.visibleBounds 
            ? this.layer.visibleBounds.x
            : this.bounds.x
    }
    get y() {
        return this.layer.visibleBounds 
            ? this.layer.visibleBounds.y
            : this.bounds.y
    }
    get width() {
        return this.bounds.width
    }
    get height() {
        return this.bounds.height
    }

    // get layerIndex() {
    //     return this.props.layerIndex
    // }
    get zIndex() {
        return this.props.active ? 300 : this.layer.zIndex
    }

    get layerStyle() {
        return {
            transform: `translateX(${this.x}px) translateY(${this.y}px)`,
            width: `${this.width}px`,
            height: `${this.height}px`,
            zIndex: this.zIndex,
        }
    }

    

    // get isLoading() {
    //     const { layerState } = this
    //     if (!layerState) return true
    //     return layerState.items.find(item => item.isLoading)
    // }

    // get loading() {
    //     const { layerState } = this
    //     if (!layerState) return null
    //     const { info } = layerState

    //     let currentLoading = null
    //     if (info && info.waitForResourceId) {
    //         const statusData = this.checkResourceIsReady(layerState)
    //         if (!statusData.isReady) {
    //             // return this.renderLoading(statusData.processingProgress)
    //             currentLoading = statusData.processingProgress
    //         }
    //     }

    //     return currentLoading
    // }

    get isShowAudio() {
        const { layerState } = this
        if (!layerState) return null
        if (layerState.layerType === AUDIO_LAYER_TYPE) return true
        if (layerState.info == null) return false

        if (layerState.info.mediaInfo != null && layerState.info.mediaInfo.audio) {
            return true
        }
    }

    get canSlide() {
        if (this.isAudio) return true
        const { layerState } = this
        if (!layerState || !layerState.items) return false

        const foundItem = layerState.items.find(item => CAN_SLIDE_ITEM_TYPES.includes(item.type) && !item.isEffectItem && !item.isMaskItem)
        return !!foundItem
    }


    // # Проверяем или ресурс загружен
    // checkResourceIsReady(layer) {
    //     const { info, id } = layer
    //     const { waitForResourceId } = info
    //     // # Ищем ресурс в ResourceManager`е, и проверяем или создан его инстанс
    //     const resource = getResource(id, waitForResourceId)
    //     return {
    //         isReady: resource && resource.resource,
    //         processingProgress: resource 
    //             ? resource.processingProgress.progress
    //             : null
    //     }
    // }

    onLayerPointerEnter = e => {
        this.props.onSetEditorData({
            highlightedElementId: e.target ? (e.target.dataset.layerid || null) : null
        })
    }

    onLayerPointerLeave = () => {
        this.props.onSetEditorData({
            highlightedElementId: null
        })
    }

    onDisableHideLock = () => {
        this.props.onSetElementStyles(
            this.sceneType, 
            this.frameIndex, 
            this.layerId, 
            "itemsContainer", 
            { 
                hideLayer: false 
            },
            true
        )
    }

    onDisableLayerLock = () => {
        this.props.onSetElementStyles(
            this.sceneType, 
            this.frameIndex, 
            this.layerId, 
            "itemsContainer", 
            { 
                disabledInteractivity: false 
            },
            true
        )
    }

    // renderLayerPlace() {
    //     if (!this.props.active) return null
    //     const style = {
    //         transform: `translateX(${this.bounds.x}px) translateY(${this.bounds.y}px)`,
    //         width: `${this.width + 6}px`,
    //         height: `${this.height + 6}px`
    //     }
    //     return <div className="t-layer-place" style={style}></div>
    // }

    // renderDragTime() {
    //     if (!this.props.active) return null
    //     const { layer } = this
    //     const startSeconds = layer.startSeconds + this.frameStart
    //     const time = secondsToTime(startSeconds < 0 ? 0 : startSeconds, true)
    //     return <div className="t-layer-drag-time">{time}</div>
    // }
    
    renderResizeDuration() {
        if (!this.props.isResizing || !this.props.active) return null
        const { layer } = this
        if (layer.bounds.width < 65) return null
        const durationSeconds = layer.durationSeconds
        const time = secondsToTime(durationSeconds < 0 ? 0 : durationSeconds, true)
        return <div className="t-layer-resize-duration">{time}</div>
    }

    renderResizePosition() {
        if (!this.props.isResizing || !this.props.active) return null
        const { layer } = this
        const { isLeftResizer } = this.props
        // # Left or Right Position in seconds
        const value = isLeftResizer ? layer.startSeconds : layer.durationSeconds + layer.startSeconds
        const time = secondsToTime(value < 0 ? 0 : value, true)
        const className = isLeftResizer ? "t-layer-resize-pos t-layer-res-left" : "t-layer-resize-pos t-layer-res-right"
        return <div className={className}>{time}</div>
    }

    renderHideLayer() {
        const { hideLayer } = this
        if (!hideLayer) return null
        
        return <div className="t-layer-unhide" onClick={this.onDisableHideLock} title="Show Layer">
            <EyeClosed />
        </div>
    }

    renderLockLayer() {
        const { locked } = this
        if (!locked) return null

        return <div className="t-layer-unlock" onClick={this.onDisableLayerLock} title="Unlock Layer">
            <Lock color={"#ffffff"} />
        </div>
    }

    getLayerClassName(layerState) {
        const { hideLayer } = this
        const { highlightedElementId, selectedElementId } = this.props
        const { active } = this.props

        if (!layerState) return "t-layer"
        if (active) {
            return "t-layer t-layer-active" 
        }
        if (layerState.id === highlightedElementId) {
            return "t-layer t-layer-highlight" 
        }
        if (hideLayer) {
            return "t-layer t-layer-hidden" 
        }
        if (layerState.id === selectedElementId) {
            return "t-layer t-layer-selected" 
        }
        return "t-layer" 
    }



    render() {
        const { layerState } = this
        const layerId = layerState ? layerState.id : null
        const className = this.getLayerClassName(layerState)
        const { width } = this

        const loadingData = getLayerLoadingData(layerState)
        const showLeftResizer = loadingData.complete && width > 10

        return (
            <div className={className} style={this.layerStyle} data-layerid={layerId} data-index={this.props.index} data-actiontype="drag" data-isloading={!loadingData.complete} onPointerEnter={this.onLayerPointerEnter} onPointerLeave={this.onLayerPointerLeave}>
                {showLeftResizer && <div className="t-layer-resize t-layer-resize-left" data-actiontype="resize" data-resizertype="left" data-isloading={false}></div>}
                {loadingData.complete && <div className="t-layer-resize t-layer-resize-right" data-actiontype="resize" data-resizertype="right" data-isloading={false}></div>}
                {(this.slideTool && this.canSlide) && <SlideToolAction offsetStart={this.props.tempOffsetStart} /> }
                <div className="t-layer-preview-wrapper">
                    {loadingData.complete
                        ? layerState 
                            ? <LayerPreview 
                                layerState={layerState} 
                                frameIndex={this.frameStart} 
                                layerIndex={this.props.index} 
                                layerBounds={this.layer}
                                tempOffsetStart={this.props.tempOffsetStart}
                            /> 
                            : null
                        : <Loading 
                            progress={loadingData.progress}
                            error={loadingData.error}
                            title={loadingData.title}
                            width={width}
                        />
                    }
                </div>
                {/* {(this.isShowAudio && this.audioMode) && <AudioEditor layerId={layerId} />} */}
                {/* {this.renderDragTime()} */}
                {this.renderResizePosition()}
                {this.renderResizeDuration()}
                {this.renderHideLayer()}
                {/* {this.renderLockLayer()} */}
            </div>
        )
       
    }

}


export default connect(
    Layer.mapStateToProps,
    Layer.mapDispatchToProps
)(Layer)
