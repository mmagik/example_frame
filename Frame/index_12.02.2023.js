
import React from "react"
import { connect } from "react-redux"
import cloneDeep from "lodash/cloneDeep"
import throttle from "lodash/throttle"

import Config from "../../../__Config/"
import { updateSequenceLayers, resizeSequenceLayers } from "../../../actions/tracks"
import { setLayoutOptions } from "../../../actions/layout"
import { setEditorData } from "../../../actions/editor"
import { changeUpdateManagerData } from "../../../actions/updateManager"
import { saveVideoOffset } from "../../../actions/videoOffsets"
import { setTimelineData } from "../../../actions/timeline"

import { ITEM_TYPES } from "../../Project/ProjectEditor/Scene/constants"
import Layer from "./Layer/"
import layerStartPx from "./helpers/layerStartPx"
import secondsToPixels from "./helpers/secondsToPixels"
import pixelsToSeconds from "./helpers/pixelsToSeconds"
import secondsToTime from "../../helpers/secondsToTime"
import isMouseDown from "./helpers/isMouseDown"
import resizingLimits from "./helpers/resizingLimits"
import calcResizeMaxDuration from "./helpers/calcResizeMaxDuration"
import calcNeighbors from "./helpers/calcNeighbors"
import reorderLayers from "./helpers/reorderLayers"
import reorderRows from "./helpers/reorderRows"
import checkElementsCount from "../../Project/ProjectEditor/helpers/checkElementsCount"

import getLayerState from "../../Project/ProjectEditor/helpers/getLayerState"
import { boundNewLayerInPlace } from "./helpers/reorderLayers"
import { DISTANCE_MODES } from "./constants"

import "./Frame.css"


const AUTO_UPDATE_LAYER_DURATION_THROTTLE = 250
const INIT_LAYERS_PARAMS_THROTTLE = 250

// # Максимально возможное к-во строк
const MAX_ROWS_COUNT = 35
// # Высота 'высокого' слоя в строке
const highLayerExpandInRow = 0.85
// # Высота слоя в строке
const layerExpandInRow = 0 // 0.2, 0, -0.25, ...
// # Не добавлять пустые строки между существующими, если в области добавления есть строки без слоев
const CHECK_BETWEEN_ROWS_SPACE = true

const SNAP_ENABLED = true
const SNAP_THRESHOLD_SECONDS = 0.1
const SNAP_AT_LAYER_END = true
// # максимальное расстояние до соседних row, по которым делаем snap
const SNAP_ROWS_NUM = 3
const CURSOR_BETWEEN_LINES_THRESHOLD = 3
// @SNAP_TO_ROW: привязываем движение только к одной строке (row) при зажатом SHIFT
const SNAP_TO_ROW = true
/* 
    @SNAP_TO_ROW_TYPE: 0 | 1
    0: Динамически привязываем слой к новой строке при отпускании и нажатии SHIFT во время движения (drag())
    1: Привязываем только к изначальной строке, которая зафиксирована нажатим SHIFT
*/
const SNAP_TO_ROW_TYPE = 0
/* 
    @DYNAMIC_RESIZE_MODE: двигаем соседние слои в строке при ресайзе, сохраняя дистанцию
    @SIMPLE_RESIZE_MODE: упираемся в соседний слой (пространство для ресайза ограничено местом между соседями)
*/
const DYNAMIC_RESIZE_MODE = 0
const SIMPLE_RESIZE_MODE = 1

const { ORDER_LAYERS_AS_ON_TIMELINE } = Config
const { 
    ENABLE_SMART_INSERT_ON_DRAG_AND_DROP,
    ENABLE_SEPARATE_AUDIO_LAYERS,
    CAN_INCREASE_DURATION_ON_PLAYBACK_RATE_CHANGE,
} = Config.TIMELINE.FRAME


function snap(val, snapVal, threshold) {
    const inRange = Math.abs(val - snapVal) <= threshold
    return inRange
        ? {
            snap: true,
            value: snapVal
        }
        : false
}

// # Типы item` ов для который на таймлайне будет широкий слой
const highItemTypes = [
    ITEM_TYPES.FILL,
    ITEM_TYPES.MP4VIDEO,
    ITEM_TYPES.WEBMVIDEO,
    ITEM_TYPES.AUDIO,
]

const AUDIO_LAYER_TYPE = "soundtrack"


const getSteppedValue = (val, step = 0) => {
    return parseFloat((Math.round(val / step) * step).toFixed(3))
}


class Frame extends React.Component {

    actionTypes = {
        DRAG: "drag",
        RESIZE: "resize",
        DROP: "drop",
        SLIDE: "slide",
    }

    // чтобы при перетаскивании bg фрейма не срабатывал клик на нем (выбор bg элемента)
    // если зажата кнопка и начать двигать то TLBgClicking = false, если нет - то это значит клик
    TLBgClicking = true
    TLBgClickingPosX = 0

    timelineNode = null

    lastUpdateTime = 0

    options = {
        timelineNodeX: 0,
        timelineNodeY: 0,
        targetX: 0,
        targetY: 0,
    }

    moveTo = null
    currentOffsetStart = null

    state = {
        layersParams: [], // mapped params from elementsState
        isEditing: false,
        actionType: null,
        layers: null,
        places: null,
        snapLine: null,
        isLeftResizer: null,
        highlightPlace: null,
        coordsBetweenRows: null,
        insertBeforeRowIndex: null,
        isResizing: null,
        activeLayerIndex: null // current editing layer index in layers array
    }


    static mapStateToProps = state => {
        return {
            timeScale: state.timeScale,
            tracks: state.tracks,
            // layout: state.layout,
            elements: state.elements,
            updateManager: state.updateManager,
            editor: state.editor,
            videoOffsets: state.videoOffsets,
            timelineScroll: state.timelineScroll
        }
    }
    static mapDispatchToProps = (dispatch) => ({
        onUpdateSequenceLayers(data) {
            dispatch(updateSequenceLayers(data))
        },
        // onResizeSequenceLayers(data) {
        //     dispatch(resizeSequenceLayers(data))
        // },
        onSetLayoutOptions(options) {
            dispatch(setLayoutOptions(options))
        },
        onSetEditorData(params) {
            dispatch(setEditorData(params))
        },
        onChangeUpdateManagerData(params) {
            dispatch(changeUpdateManagerData(params))
        },
        onSaveVideoOffset(layerId, resourceId, offsetStart) {
            dispatch(saveVideoOffset(layerId, resourceId, offsetStart))
        },
        onSetTimelineData(data) {
            dispatch(setTimelineData(data))
        },
    })


    get slideTool() {
        return this.props.editor.slideTool
    }

    get separateAudioLayers() {
        return ENABLE_SEPARATE_AUDIO_LAYERS
    }

    get sceneIndex() {
        return this.props.sceneIndex
    }

    get sceneType() {
        return this.props.sceneType
    }

    get scene() {
        const { sceneIndex } = this
        return this.props.elements[sceneIndex]
    }

    get frameLayers() {
        const { scene, frameIndex } = this
        return scene.frames[frameIndex] ? scene.frames[frameIndex].children : []
    }

    get trackId() {
        return this.props.trackId
    }

    get maxSceneDuration() {
        return this.props.sceneParams.maxSceneDuration
    }

    get highlightedElementId() {
        return this.props.editor.highlightedElementId
    }
    get selectedElementId() {
        return this.props.editor.selectedElementId
    }

    get scaleLeftMargin() {
        return this.props.timeScale.scaleLeftMargin
    }

    get audioMode() {
        return this.props.editor.audioMode
    }

    get frameIndex() {
        return this.props.frameIndex
    }

    get frame() {
        const { trackId } = this
        const layers = this.props.tracks[trackId].sequence[this.frameIndex]
        if (!this.separateAudioLayers) return layers

        layers.forLayers.forEach((layer, i) => {
            let show = true
            if (this.frameLayers[i]) {
                const layerState = this.frameLayers[i]
                if (this.audioMode) {
                    show = layerState.layerType === AUDIO_LAYER_TYPE
                } else {
                    show = layerState.layerType !== AUDIO_LAYER_TYPE
                }
            }
            layer.show = show
        })
        return layers
    }
    

    get activeLayer() {
        const { activeLayerIndex } = this.state
        if (activeLayerIndex == null) return
        return this.calculatedLayers[activeLayerIndex]
    }

    get rowsNumber() {
        const layers = this.frame.forLayers.filter(layer => layer.show)
        const num = 1 + Math.max(
            ...layers.map((layer) => layer.row)
        )
        return num
    }

    // # Original Layers State
    get layers() {
        const { frame } = this
        return frame ? frame.forLayers : []
    }

    // # Layers Calculated Pixels
    get calculatedLayers() {
        const { frame } = this

        // # Layers While editing
        if (this.state.layers) {
            return this.state.layers.map(this.mapLayer)
        }

        return frame
            ? frame.forLayers.map(this.mapLayer)
            : []
    }

    get rowHeight() {
        return this.props.timeScale.rowHeight
    }

    get timelineDistanceMode() {
        return this.props.editor.timelineDistanceMode
    }

    get snapEnabled() {
        return !this.props.ctrlKeyPressed
    }

    get smartInsertOnDragAndDrop() {
        // return false
        return ENABLE_SMART_INSERT_ON_DRAG_AND_DROP
    }

    stopClicking(e) {
        if (Math.abs(e.x - this.TLBgClickingPosX) > 3) {
            this.TLBgClicking = false
        }
    }

    getLayerHeight(layer, layerIndex) {
        // @layerIndex - постоянный индекс в массиве элементов в state.tracks.forLayers
        const { layersParams } = this.state,
            { rowHeight } = this,
            layerParams = layersParams[layerIndex],
            high = layerParams && layerParams.high

        if (high) {
            return rowHeight / (1 + 1 - highLayerExpandInRow)
        }
        if (this.rowHeight <= 30) {
            return rowHeight / (1 + 1 - highLayerExpandInRow)
        }
        return rowHeight / (1 + 1 - layerExpandInRow)
    }


    // # Arrange Layers and calculate their positions in pixels on timeline
    mapLayer = (layer, i) => {
        const { rowHeight } = this,
            startSeconds = layer.custom.start,
            durationSeconds = layer.custom.duration,
            row = layer.row,
            height = this.getLayerHeight(layer, i)

        return {
            show: layer.show,
            row,
            high: layer.high,
            zIndex: row + i,
            visibleBounds: layer.visibleBounds,
            startSeconds,
            durationSeconds,
            bounds: {
                x: layerStartPx(startSeconds, this.props.timeScale),
                y: row * rowHeight + (rowHeight-height)/2 - 1,
                width: secondsToPixels(durationSeconds, this.props.timeScale),
                height
            }
        }
    }


    updateState(type, data, ignoreReorder) {
        const { DRAG, RESIZE } = this.actionTypes

        if (type === DRAG || type === RESIZE) {
            const selectorMinStepSeconds = this.props.timeScale.selectorMinStepSeconds
            if (data) {
                data = data.map(item => {
                    if (!item.custom) return item
                    const custom = {...item.custom}

                    if (custom.start) {
                        custom.start = getSteppedValue(custom.start, selectorMinStepSeconds)
                    }
                    if (custom.duration) {
                        custom.duration = getSteppedValue(custom.duration, selectorMinStepSeconds)
                    }
                    // console.log(custom)
                    return {
                        ...item,
                        custom
                    }
                })
            }

            this.props.onUpdateSequenceLayers({
                trackId: this.trackId,
                frameIndex: this.frameIndex,
                data,
                // Если не проверить переменную "ignoreReorder", то будет бесконечный цикл 
                updateReorderStamp: !ignoreReorder && (type === DRAG || type === RESIZE)
            })

            if (type === DRAG) {
                if (ORDER_LAYERS_AS_ON_TIMELINE) {
                    this.props.onChangeUpdateManagerData({
                        needUpdateScene: {
                            sceneType: this.sceneType,
                            frameIndex: this.frameIndex,
                            updateType: "frame"
                        }
                    })
                }
            } else {
                if (this.currentOffsetStart) {
                    const { layerId, resourceId, offsetStart } = this.currentOffsetStart
                    this.props.onSaveVideoOffset(layerId, resourceId, offsetStart)
                }
            }

            // # Update Layout stamp to trigger update timeline vertical scroll
            this.props.onSetLayoutOptions({
                stamp: Math.random()
            })
        }
    }

    insertLayerBetweenRows(insertBeforeRowIndex, isDrop) {
        const { activeLayerIndex, dropLayerTrack } = this.state
        let layers = cloneDeep(this.layers)

        if (isDrop) {
            if (!dropLayerTrack) return
            layers = [
                ...layers,
                dropLayerTrack
            ]
        }

        const activeLayer = layers[activeLayerIndex]
        if (!activeLayer || !this.calculatedLayers[activeLayerIndex]) return

        const { maxSceneDuration } = this
        const { startSeconds } = this.calculatedLayers[activeLayerIndex]

        let start = (startSeconds < 0 ? 0 : startSeconds)
        const end = start + activeLayer.custom.duration

        if (end > maxSceneDuration) {
            start = maxSceneDuration - activeLayer.custom.duration
        }

        activeLayer.row = insertBeforeRowIndex
        activeLayer.custom.start = start

        if (isDrop) {
            activeLayer.dropOnLayerIndex = activeLayerIndex
        }

        const result = layers.map((layer, index) => {
            if (index === activeLayerIndex || !layer.show) return layer

            if (layer.row >= insertBeforeRowIndex) {
                layer.row = layer.row + 1
            }
            return layer
        })

        this.updateState("drag", result)

        if (isDrop) {
            this.props.onSetEditorData({
                dropOnLayerTrack: activeLayer
            })
        }
    }

    finishDrag() {
        const { moveTo } = this
        const { activeLayerIndex, insertBeforeRowIndex, actionType, dropLayerTrack } = this.state
        const isDrop = actionType === this.actionTypes.DROP

        if (insertBeforeRowIndex != null) {
            this.insertLayerBetweenRows(insertBeforeRowIndex, isDrop)
            return
        }

        if (!isDrop && !moveTo) return

        if (!moveTo) return

        let layers = cloneDeep(this.layers)

        if (isDrop) {
            if (!dropLayerTrack) return
            layers = [
                ...layers,
                dropLayerTrack
            ]
        }

        const activeLayer = layers[activeLayerIndex]
        if (!activeLayer) return

        // console.log("moveTo", moveTo)

        const moveToRowIndex = moveTo ? moveTo.rowIndex : 0

        activeLayer.row = moveToRowIndex
        activeLayer.custom.start = moveTo ? moveTo.start : 0

        if (moveTo.duration) {
            activeLayer.custom.duration = moveTo.duration
        }


        // # добавочное значение для правильной сортировки, когда у активного слоя и существующего одиноковый start
        // для правильного результата активный слой нужно поместить первым
        activeLayer.isActive = true
        if (isDrop) {
            activeLayer.dropOnLayerIndex = activeLayerIndex
        }

        // # re-arrange layers in target row
        layers = layers.map((layer, index) => ({
            ...layer,
            index
        }))

        layers.sort((a,b) => {
            const diff = (a.custom.start) - (b.custom.start)
            if (diff === 0 && a.isActive) {
                return -0.1
            }
            return diff
        })

        // # remap target row
        let shift = 0

        const remapped = layers
            .filter(layer => layer.row === moveToRowIndex)
            .map((layer, i, arr) => {
                if (!layer.show || layer.index === activeLayerIndex || layer.custom.start < activeLayer.custom.start) {
                    // console.log("ignore", layer)
                    return layer
                }

                // const prevLayer = arr[i-1]
                // console.log("current i", i)
                // console.log("arr", arr)
                const prevLayer = arr.findLast((l, j) => j <= i-1 && l.show)
                // console.log("prevLayer", prevLayer)

                // if (!prevLayer) return layer

                // const layerEnd = prevLayer.custom.start + prevLayer.custom.duration
                const layerEnd = !prevLayer ? 0 : prevLayer.custom.start + prevLayer.custom.duration
                // console.log("layerEnd", layerEnd)
                // console.log("layer.custom", layer.custom)
                // const isLayerEndGreaterThanNextLayerStart = prevLayer && layerEnd >= layer.custom.start
                // const isLayerEndGreaterThanNextLayerStart = prevLayer ? layerEnd >= layer.custom.start : false
                const isLayerEndGreaterThanNextLayerStart = layerEnd >= layer.custom.start

                const diff = layer.custom.start - layerEnd

                if (isLayerEndGreaterThanNextLayerStart) {
                    shift = shift > 0
                        ? shift 
                        : layerEnd - layer.custom.start
                }

                // # Если слой перетаскиваем в место, где другие слои соединяются впритык, т.е. длительность места вставки = 0 сек
                // В данном случае двигаем слои, которые справа на длительность перетаскиваемого слоя
                /* 
                activeLayer.custom.start >= layerEnd
                это условие проверяет или активный слой перетаскиваем не в самое начало всех слоев слева, чтобы не двигать слои справа
                */
                // console.log("diff", diff)
                // console.log("effectMinimumDuration", this.props.timeScale.effectMinimumDuration)
                // console.log(activeLayer.custom.start, layerEnd)
                // console.log("shift", shift)
                if (diff < this.props.timeScale.effectMinimumDuration && activeLayer.custom.start >= layerEnd) {
                    shift = shift > 0 ? shift : activeLayer.custom.duration
                }

                layer.custom.start += shift
                return layer
            })

        /* 
        # Ниже пример, когда при сдвигании слоев справа, также будут сокращаться расстояния между ними
        */
        // const remapped = layers
        //     .filter(layer => layer.row === moveToRowIndex)
        //     .map((layer, i, arr) => {
        //         const prevLayer = arr[i-1]
        //         let shift = 0
        //         if (prevLayer && prevLayer.custom.start + prevLayer.custom.duration > layer.custom.start) {
        //             shift = prevLayer.custom.start + prevLayer.custom.duration - layer.custom.start
        //         }
        //         layer.custom.start += shift
        //         return layer
        //     })
        

        // # add other rows
        let result = [
            ...remapped,
            ...layers.filter(layer => layer.row !== moveToRowIndex)
        ]


        // # back layers sort as in state
        result.sort((a, b) => a.index - b.index)

        result = result.map(layer => {
            delete layer.index
            delete layer.isActive
            delete layer.show
            return layer
        })

        // console.log("result", result)

        this.updateState("drag", result)

        if (isDrop) {
            this.props.onSetEditorData({
                dropOnLayerTrack: activeLayer
            })
        }
    }

    finishResize() {
        if (!this.state.layers) return
        let layers = cloneDeep(this.state.layers)

        this.updateState("resize", layers)
    }

    finish() {
        const { actionType } = this.state
        if (this.state.actionType === this.actionTypes.RESIZE) {
            this.finishResize()
        } else if (actionType === this.actionTypes.DRAG || actionType === this.actionTypes.DROP) {
            this.finishDrag()
        }
    }

    deleteActionParams() {
        window.removeEventListener("pointermove", this.onPointerMove)
        window.removeEventListener("pointerup", this.cancelEditing)
        isMouseDown(false)
        this.isMouseDown = false
        this.setState(prevState => ({
            ...prevState,
            isEditing: false,
            actionType: null,
            activeLayerIndex: null,
            layers: null,
            places: null,
            isLeftResizer: null,
            highlightPlace: null,
            snapLine: null,
            coordsBetweenRows: null,
            insertBeforeRowIndex: null,
            isResizing: null,
            dropLayerTrack: null,
            isDrop: false
        }))
    }

    // # Exit on Pointer Up
    cancelEditing = () => {
        this.lastUpdateTime = Date.now()

        this.finish()
        this.deleteActionParams()

        this.moveTo = null
        this.currentOffsetStart = null
        this.resizingLayers = null
        this.resizingLimits = null
        this.snapPoints = null
        // this.offsetsData = null
    }

    // # Get Row index 0..x by 'y' coordinate
    pixelsToRow(y = 0) {
        const { rowsNumber } = this
        const row = Math.round( (y-8) / this.rowHeight)
        const maxRows = rowsNumber >= MAX_ROWS_COUNT ? MAX_ROWS_COUNT-1 : rowsNumber
        return row < 0 
            ? 0 
            : row >= maxRows
                ? maxRows
                : row
    }


    getResizingLimits(activeLayerIndex, isLeftResizer) {
        if (activeLayerIndex == null || !this.layers[activeLayerIndex]) return
        const activeLayer = this.layers[activeLayerIndex]
        if (!activeLayer || activeLayerIndex == null || isLeftResizer == null) return
        const { layersParams } = this.state
        if (!layersParams || !layersParams[activeLayerIndex]) return

        const layerParams = layersParams[activeLayerIndex]
        const layerState = layerParams.layer
        const limits = resizingLimits(layerState, this.props, this.maxSceneDuration, isLeftResizer)

        return {
            min: limits.min,
            max: limits.max,
            offsetStart: limits.offsetStart,
            limitByOffsetStart: limits.limitByOffsetStart,
            resourceId: limits.resourceId,
            layerId: limits.layerId
        }
    }


    // # Получаем другие слои в строке помимо активного, которые будем ресайзить вместе
    getLayersForResize(activeLayerIndex, isLeftResizer) {
        if (activeLayerIndex == null || !this.layers[activeLayerIndex]) return
        const activeLayer = this.layers[activeLayerIndex]

        if (!activeLayer || activeLayerIndex == null || isLeftResizer == null) return
        const start = activeLayer.custom.start
        const end = start + activeLayer.custom.duration

        const result = this.layers.filter((layer, index) => {
            if (index !== activeLayerIndex && layer.row === activeLayer.row && layer.show) {
                if (isLeftResizer) {
                    if (layer.custom.start + layer.custom.duration <= start) {
                        layer.index = index
                        layer.distance = start - (layer.custom.start + layer.custom.duration)
                        return true
                    }
                } else {
                    if (layer.custom.start >= end) {
                        layer.index = index
                        layer.distance = layer.custom.start - end
                        return true
                    }
                }
            }
        })

        // # Сортируем соседние слои от самых близких до самых дальних
        // это нужно для RESIZE_MODE = 1
        if (result.length) {
            result.sort((a,b) => a.distance - b.distance)
        }

        return result
    }

    calcThreshold() {
        return Math.min(0.22, SNAP_THRESHOLD_SECONDS * (76 / this.props.timeScale.pixelsPerDivision))
    }

    snapLayerOnResize(start, duration, row, isLeftResizer) {
        const { snapPoints } = this
        const threshold = this.calcThreshold()
        const result = {
            start,
            duration,
        }

        if (snapPoints && this.snapEnabled) {
            const found = snapPoints.find(point => {
                if (Math.abs(point.row - row) > SNAP_ROWS_NUM) return false
                if (isLeftResizer) {
                    const snapValue = snap(start, point.position, threshold)
                    if (snapValue) {
                        result.start = snapValue.value
                        result.duration = start + duration - snapValue.value
                        return true
                    } else {
                        this.snapLine = null
                    }
                } else {
                    const snapValue = snap(start+duration, point.position, threshold)
                    if (snapValue) {
                        result.duration = snapValue.value - start
                        return true
                    } else {
                        this.snapLine = null
                    }
                }
            })
            if (found) {
                this.drawSnapLine(found, row)
            }
        }

        this.updateSnapLineInState()

        return result
    }


    resizeLayer(params) {
        const { 
            activeLayerIndex, 
            isLeftResizer, 
            resizingLayers, 
            resizingLimits, 
            maxSceneDuration, 
            resizeMode,
            row, 
            start, 
            duration 
        } = params

        const distanceMode = this.timelineDistanceMode
        // @limitRightResizingByLast: Ограничивать ресайзинг справа - end последнего слоя справа не должен выйти за макс. длительность сцены
        // Если выключено, то ограничиваем только слой, который ресайзим, а слои справа могут выйти за пределы макс. длительности
        const limitRightResizingByLast = false

        if (activeLayerIndex == null || isLeftResizer == null || !resizingLimits) return

        const end = start + duration

        // ### Result of layers bounds in row
        let result = {}

        // ### New Start And Duration for Active Layer
        let newDuration = duration
        let newStart = start

        // ### Begin of adding min and max limits
        // # Minimum and Maximum possible duration of layer
        // value '-1' means that duration is not limited
        const minDuration = resizingLimits.min
        let maxDuration = Math.min(
            resizingLimits.max, 
            maxSceneDuration,
            isLeftResizer ? maxSceneDuration : maxSceneDuration - start // max duration with adding "start" position
        )
        // # Ограничения длительности редактируемого слоя, зависящие от соседних слоёв
        // (на сколько мы можем растянуть слой, учитывая движение соседних слоев при ресайзе)
        if (isLeftResizer || limitRightResizingByLast) {
            const __maxDuration = calcResizeMaxDuration(resizingLayers, {
                maxSceneDuration, 
                start: newStart,
                end: newDuration + newStart,
                isLeftResizer,
                isDynamicResizeMode: resizeMode === DYNAMIC_RESIZE_MODE,
                distanceMode
            })
    
            maxDuration = Math.min(__maxDuration, maxDuration)
        }
        
        // ### End of adding min and max limits


        // ### Snap begin
        const snap = this.snapLayerOnResize(newStart, newDuration, row, isLeftResizer)
        newStart = snap.start
        newDuration = snap.duration
        // ### Snap end


        // ### Limits for Active Layer
        // # Limit for Minimum Value
        if (newDuration <= minDuration) {
            if (isLeftResizer) {
                newDuration = minDuration
                newStart = end - newDuration
            } else {
                newDuration = minDuration
            }
        } else if (newDuration >= maxDuration) {
        /* # Limit on Maximum Value */
            if (isLeftResizer) {
                newDuration = maxDuration
                newStart = end - newDuration
            } else {
                // # limits for maximum value by layer own limit
                newDuration = maxDuration
            }
        } 
        // # Limit if cursor <= 0 on left Resize
        if (isLeftResizer && newStart <= 0) {
            newStart = 0
            newDuration = end
        }
        // ### End Limits for Active Layer
        

        // ### Offset Start Update on left resizer and control it limits
        if (isLeftResizer && resizingLimits.limitByOffsetStart) {
            const layerTrack = this.layers[activeLayerIndex]
            if (!layerTrack) return
            const prevStart = layerTrack.custom.start
            const prevOffsetStart = resizingLimits.offsetStart
            const distance = newStart - prevStart
            const minStart = prevStart - prevOffsetStart

            let newOffsetStart = prevOffsetStart + distance

            // # in case if offsetStart <= 0 (stop resize at point)
            if (newStart <= minStart) {
                newStart = minStart
                newDuration = end - newStart
                newOffsetStart = 0
            }

            if (resizingLimits.layerId && resizingLimits.resourceId) {
                // # Записываем данные во временный объект.
                // Данные в redux будут обновлены при отпускании кнопки позже
                this.currentOffsetStart = {
                    layerId: resizingLimits.layerId,
                    resourceId: resizingLimits.resourceId,
                    offsetStart: newOffsetStart,
                    layerIndex: activeLayerIndex
                }
            }
        }
        // ### End of offsetStart update


        // ### Active Layer new bounds
        result[activeLayerIndex] = {
            row,
            custom: {
                start: newStart,
                duration: newDuration
            }
        }


        // ### Begin shift other layers (neighbors) on the same row
        result = calcNeighbors(resizingLayers, newStart, newDuration, isLeftResizer, result, distanceMode)

        return result
    }


    // # Get places where dragged layer can be put
    dragLayer(rowIndex, cursorX) {
        const { activeLayerIndex, places } = this.state
        if (activeLayerIndex == null || !places) return

        // const cursorSeconds = pixelsToSeconds(cursorX, this.props.timeScale)

        // # Промежутки для вставки слоя в конкретной строке (row)
        const rowPlaces = places[rowIndex]

        // # Таймлайн пустой
        if (!rowPlaces) {
            this.moveTo = {
                start: Math.max(0, this.activeLayer.startSeconds),
                rowIndex: 0
            }
            return
        }

        // ? работает не правильно
        // console.log("cursorY", cursorY)
        // # Ограничение вытаскивание за верхнюю границу Таймлайна
        // if (cursorY < 15) {
        //     this.moveTo = null
        //     this.setState(prevState => ({
        //         ...prevState,
        //         highlightPlace: null
        //     }))
        //     return
        // }

        const start = this.activeLayer.startSeconds
        const end = this.activeLayer.startSeconds + this.activeLayer.durationSeconds
        const duration = this.activeLayer.durationSeconds

        // # Массив возможных мест для вставки перетаскиваемого слоя (потом будет выбрано наиболее подходящее)
        const possiblePlaces = rowPlaces.filter(place => {
            if (start > place.end) return false
            if (end <= place.start) return false
            return true
        })
        // console.log("possiblePlaces[0]", possiblePlaces[0])
        if (!possiblePlaces.length) return

        // # Есть несколько подходящих мест для вставки, выбираем одно
        if (possiblePlaces.length > 1) {
            const intersects = possiblePlaces.map((place, j) => {
                if (place.duration <= 0) {
                    // const distanceToCursor = Math.abs(cursorSeconds - place.start)
                    // if (distanceToCursor > 0.25) return 0
                    // const dist = (0.25 - distanceToCursor) / 0.25
                    // return dist > 0.8 ? 1 : dist

                    const distanceToCursor = Math.abs(cursorX - secondsToPixels(place.start, this.props.timeScale))
                    if (distanceToCursor <= 6) return 3
                    return 0
                } else {
                    if (place.end === "end") {
                        return (end - place.start) / duration
                    }
                    if (j === 0 && start < 0) {
                        return Math.abs(start) * 2
                    }
                    return (place.end - start) / duration
                }
                
            })

            // # find max intersect
            let index = 0
            let max = intersects[0]
            for(let i=1; i<intersects.length; i++) {
                if (intersects[i] > max) {
                    index = i
                }
            }

            let bestPlace = possiblePlaces[index]
            const putAt = (start > bestPlace.start ? start : bestPlace.start)

            let smartBounds = null
            if (this.smartInsertOnDragAndDrop) {
                smartBounds = boundNewLayerInPlace(
                    {
                        start: this.activeLayer.startSeconds,
                        duration: this.activeLayer.durationSeconds
                    },
                    bestPlace,
                    this.activeLayer.startSeconds,
                    this.props.timeScale.effectMinimumDuration
                )
            }


            this.moveTo = {
                start: putAt,
                rowIndex
            }
            this.moveTo.start = this.snapLayerOnDrag(this.moveTo.start, duration, rowIndex)
            // # highlight put place

            if (smartBounds) {
                this.moveTo.duration = smartBounds.duration
                this.moveTo.start = smartBounds.start
            } else {
                this.moveTo.duration = null
            }
            
            const highlightPlace = {
                start: this.moveTo.start,
                // duration: bestPlace.end - putAt,
                duration: this.moveTo.duration
                    ? this.moveTo.duration
                    : bestPlace.end - putAt
            }
            this.setState(prevState => ({
                ...prevState,
                highlightPlace
            }))

        } else {
            if (!possiblePlaces.length) {
                // # Dont Put Layer
                this.moveTo = null
                this.setState(prevState => ({
                    ...prevState,
                    highlightPlace: null
                }))
            } else {
                let place = possiblePlaces[0]
                let smartBounds = null
                // console.log("place", place)

                // # Пытаемся поместить новый слой в свободное пространство, укорачивая его, если нужно. Другие слои в строке при этом не двигаем
                // Другие слои будут двигаться, если свободно пространство будет меньше значения timeScale.effectMinimumDuration
                if (this.smartInsertOnDragAndDrop) {
                    smartBounds = boundNewLayerInPlace(
                        {
                            start: this.activeLayer.startSeconds,
                            duration: this.activeLayer.durationSeconds
                        },
                        place,
                        this.activeLayer.startSeconds,
                        this.props.timeScale.effectMinimumDuration
                    )
                }
                
                // console.log("smartBounds", smartBounds)
                if (smartBounds) {
                    place = smartBounds
                }

                if (place.duration <= 0 && place.start > 0) {
                    const distanceToCursor = Math.abs(cursorX - secondsToPixels(place.start, this.props.timeScale))
                    if (distanceToCursor > 6) {
                        // # Dont Put Layer
                        this.moveTo = null
                        this.setState(prevState => ({
                            ...prevState,
                            highlightPlace: null
                        }))
                        return
                    }
                }
                
                const putAt = start > place.start ? start : place.start

                this.moveTo = {
                    start: putAt,
                    rowIndex
                }
                this.moveTo.start = this.snapLayerOnDrag(this.moveTo.start, duration, rowIndex)
                if (smartBounds) {
                    this.moveTo.duration = smartBounds.duration
                    this.moveTo.start = smartBounds.start
                } else {
                    this.moveTo.duration = null
                }

                // const highlightPlace = {
                //     start: putAt,
                //     duration: place.end - putAt
                // }
                const highlightPlace = {
                    start: this.moveTo.start,
                    duration: this.moveTo.duration || place.end - putAt
                }

                this.setState(prevState => ({
                    ...prevState,
                    highlightPlace
                }))
            }
        }

        // if (this.moveTo) {
        //     this.moveTo.start = this.snapLayerOnDrag(this.moveTo.start, duration, rowIndex)
        // }
    }

    // # Получаем промежутки между слоями куда можно перетащить слой для каждой строки
    getPlaces(activeLayerIndex) {
        const { rowsNumber } = this,
            layers = this.layers.filter((layer, index) => index !== activeLayerIndex && layer.show),
            maxRows = rowsNumber + 1 >= MAX_ROWS_COUNT ? MAX_ROWS_COUNT : rowsNumber + 1,
            currentLayers = {},
            result = {}

        for (let i=0; i<maxRows; i++) {
            const rowData = layers.filter(layer => layer.row === i)
            currentLayers[i] = rowData
                .map(layer => layer.custom)
                .sort((a,b) => a.start-b.start)
        }

        const rows = Object.keys(currentLayers)

        rows.forEach(row => {
            result[row] = []
            const layersInRow = currentLayers[row]

            // # if row is empty
            if (!layersInRow.length) {
                result[row].push({
                    start: 0,
                    end: "end",
                    duration: "end"
                })
            }
            
            layersInRow.forEach((layer, i) => {
                const layerEnd = layer.start + layer.duration
                // before layers
                if (i === 0) {
                    result[row].push({
                        start: 0,
                        end: layer.start,
                        duration: layer.start
                    })
                }
                // between layers
                if (layersInRow[i+1] !== undefined) {
                    const nextLayer = layersInRow[i+1]
                    result[row].push({
                        start: layerEnd,
                        end: nextLayer.start,
                        duration: nextLayer.start - layerEnd
                    })
                } else {
                    // last
                    result[row].push({
                        start: layerEnd,
                        end: "end",
                        duration: "end"
                    })
                }
            })
        })

        return result
    }

    getCoordsBetweenRows(activeLayerIndex, dropLayerTrack) {
        const { rowHeight } = this
        const result = []

        const layers = (
            dropLayerTrack 
                ? [
                    ...this.frame.forLayers,
                    dropLayerTrack,
                ] 
                : this.frame.forLayers
        )

        const activeLayer = layers[activeLayerIndex]

        if (!activeLayer) return []

        const maxRowIndex = Math.max(...layers.filter(layer => layer.show).map(layer => layer.row))
        const lastRowLength = layers.filter(layer => layer.row === maxRowIndex && layer.show).length

        let maxRows = this.rowsNumber
        if (lastRowLength <= 1 && activeLayer.row === maxRowIndex) {
            maxRows = maxRows - 1
        }

        for(let i=0; i<maxRows; i++) {
            if (layers[i] && !layers[i].show) {
                result.push(null)
            } else {
                // # не разрешаем перемещение между между строками, если соседние ячейки пустые
                if (CHECK_BETWEEN_ROWS_SPACE && i > 0 && (!layers.find(layer => layer.row === i-1) || !layers.find(layer => layer.row === i) )) {
                    result.push(null)
                } else {
                    result.push(i * rowHeight)
                }
            }
        }

        return result
    }

    cursorBetweenRows(y = 0) {
        const { coordsBetweenRows } = this.state
        if (!coordsBetweenRows) return null

        const threshold = CURSOR_BETWEEN_LINES_THRESHOLD
        const position = y + threshold/2

        // # Вытаскивание за область Таймлайна сверху
        if (position < 0) {
            return position < -12 ? null : 0
        }

        const rowIndex = coordsBetweenRows.findIndex(coord => {
            if (coord != null && Math.abs(coord - y) <= threshold) return true
        })

        return rowIndex === -1 ? null : rowIndex
    }

    setTimelineBounds() {
        const timelineNodeRect = this.timelineNode.getBoundingClientRect()
        this.options.timelineNodeX = timelineNodeRect.left
        this.options.timelineNodeY = timelineNodeRect.top
    }


    drawSnapLine(snap, row) {
        if (!snap && this.state.snapLine) {
            this.snapLine = null
            return
        }
        const { rowHeight } = this,
            startX = secondsToPixels(snap.position, this.props.timeScale) + this.scaleLeftMargin,
            startY = Math.min(snap.row, row) * rowHeight,
            endY = Math.max(snap.row, row) * rowHeight - startY + rowHeight

        this.snapLine = {
            startY, startX, endY
        }
    }


    snapLayerOnDrag(start, end, row, drawLine) {
        const { snapPoints } = this
        const threshold = this.calcThreshold()
        const snapAtLayerEnd = SNAP_AT_LAYER_END

        let result = start
        let snapAtEnd = false

        if (snapPoints && this.snapEnabled) {
            const found = snapPoints.find(point => {
                if (Math.abs(point.row - row) > SNAP_ROWS_NUM) return false
                // # Snap start position
                const snapStart = snap(start, point.position, threshold)

                // # Snap end point
                const snapEnd = (snapAtLayerEnd && !snapStart) ? snap(end, point.position, threshold) : null

                if (snapStart || snapEnd) {
                    snapAtEnd = !!snapEnd
                    return true
                }
            })
            if (found) {
                if (drawLine) {
                    this.drawSnapLine(found, row)
                }
                
                if (snapAtEnd) {
                    result = found.position - (end-start)
                } else {
                    result = found.position
                }
            } else {
                this.snapLine = null
            }
        }
        return result
    }

    __updateSnapLineInState = () => {
        this.setState(prevState => ({
            ...prevState,
            snapLine: this.isMouseDown ? cloneDeep(this.snapLine) : null
        }))
    }

    updateSnapLineInState = throttle(this.__updateSnapLineInState, 100)

    getLayerStartOnDrag(x, layer) {
        let start = pixelsToSeconds(x, this.props.timeScale)
        const end = start + layer.custom.duration
        const { maxSceneDuration } = this

        if (end > maxSceneDuration) {
            start = maxSceneDuration - layer.custom.duration
        }

        if (!SNAP_ENABLED) {
            return start
        } else {
            const result = this.snapLayerOnDrag(start, end, layer.row, true)
            this.updateSnapLineInState()
    
            return result
        }

    }


    initSnapPoints(activeLayerIndex) {
        if (!SNAP_ENABLED) return null

        const layers = this.layers.filter((layer, index) => 
            index !== activeLayerIndex && layer.show
        )
        const points = []

        layers.forEach(layer => {
            points.push({
                row: layer.row,
                position: layer.custom.start
            })
            points.push({
                row: layer.row,
                position: layer.custom.start + layer.custom.duration,
                isEndPosition: true
            })
        })
        return points
    }


    slide(e) {
        const { activeLayer, resizingLimits } = this
        if (!activeLayer || !resizingLimits) return
        const { durationSeconds } = activeLayer

        const maxDuration = resizingLimits.max
        const maxOffset = maxDuration + resizingLimits.offsetStart - durationSeconds

        const cursorShiftX = e.clientX - this.options.startClientX
        const cursorSeconds = pixelsToSeconds(cursorShiftX, this.props.timeScale)

        let newOffset = resizingLimits.offsetStart - cursorSeconds
        if (newOffset < 0) {
            newOffset = 0
        }
        if (newOffset > maxOffset) {
            newOffset = maxOffset
        }

        if (!isNaN(newOffset)) {
            this.props.onSaveVideoOffset(resizingLimits.layerId, resizingLimits.resourceId, newOffset)

            this.currentOffsetStart = {
                layerId: resizingLimits.layerId,
                resourceId: resizingLimits.resourceId,
                offsetStart: newOffset,
                layerIndex: this.state.activeLayerIndex
            }
        }
    }

    getSteppedPixels(pixels) {
        const pixelsPerDivision = this.props.timeScale.pixelsPerDivision
        const selectorMinStepSeconds = this.props.timeScale.selectorMinStepSeconds
        const pixelsToSeconds = (positionInPixels, pixelsPerDivision, selectorMinStepSeconds) => {
            return parseFloat((Math.round(positionInPixels / pixelsPerDivision / selectorMinStepSeconds) * selectorMinStepSeconds).toFixed(3))
        }
        const steppedSeconds = pixelsToSeconds(pixels, pixelsPerDivision, selectorMinStepSeconds)
        return steppedSeconds * pixelsPerDivision
    }


    drag(e) {

        // # Привязываем движение слоя только к одной строке
        // Также меняем строку привязки, если shift был отпущен и зажат, когда слой переместился в другое место, пока shift был отпущен
        if (SNAP_TO_ROW) {
            if (SNAP_TO_ROW_TYPE === 1) {
                /* 
                Блокировка по оси Y, где слой привязываем к самой первой строке, где был клик
                Тут мы не меняем строку привязки пока не завершится текущее перетаскивание (кнопка мыши будет отпущена)
                */
                this.blockCursorPositionY = this.props.shiftKeyPressed
                    ? this.options.startClientY != null ? this.options.startClientY : e.pageY
                    : e.pageY
            } else {
                if (this.blockCursorPositionY == null && this.props.shiftKeyPressed) {
                    this.blockCursorPositionY = e.pageY
                } else if (!this.props.shiftKeyPressed) {
                    this.blockCursorPositionY = null
                }
            }
            
        }

        const pageY = this.blockCursorPositionY != null && SNAP_TO_ROW
            ? this.blockCursorPositionY
            : e.pageY

        const cursorY = pageY - this.options.timelineNodeY - 4
        const x = e.pageX - this.options.timelineNodeX - this.scaleLeftMargin - this.options.targetX,
            y = pageY - this.options.timelineNodeY - this.options.targetY,
            rowIndex = this.pixelsToRow(y)


        // const pixelsPerDivision = this.props.timeScale.pixelsPerDivision
        // const selectorMinStepSeconds = this.props.timeScale.selectorMinStepSeconds
        // const pixelsToSeconds = (positionInPixels, pixelsPerDivision, selectorMinStepSeconds) => {
        //     return parseFloat((Math.round(positionInPixels / pixelsPerDivision / selectorMinStepSeconds) * selectorMinStepSeconds).toFixed(3))
        // }
        
        let cursorX = e.pageX - this.options.timelineNodeX - this.scaleLeftMargin
        // console.log("cursorX", cursorX)
        // const steppedSeconds = pixelsToSeconds(cursorX, pixelsPerDivision, selectorMinStepSeconds)
        // const steppedPixels = steppedSeconds * pixelsPerDivision
        // cursorX = steppedPixels
        cursorX = this.getSteppedPixels(cursorX)
            

        // Коррекция позиции курсора, компенсируем смещение клика по оси "y", чтобы при перетаскивании ориентироваться на середину слоя
        const mid = this.rowHeight/2 - this.options.targetY
        const insertBeforeRowIndex = this.cursorBetweenRows(cursorY + mid)

        this.dragLayer(rowIndex, cursorX)

        if (this.state.layers) {
            this.setState(prevState => ({
                ...prevState,
                insertBeforeRowIndex,
                layers: prevState.layers.map((layer, index) => {
                    if (this.state.activeLayerIndex !== index) return layer
                    return {
                        ...layer,
                        row: rowIndex,
                        visibleBounds: {
                            x: x + this.scaleLeftMargin,
                            y
                        },
                        custom: {
                            ...layer.custom,
                            start: this.getLayerStartOnDrag(x, layer)
                        }
                    }
                })
            }))
        }
    }


    resize(e) {
        const x = e.pageX - this.options.timelineNodeX - this.scaleLeftMargin - this.options.targetX,
            { activeLayer, resizingLayers, resizingLimits, maxSceneDuration } = this,
            { isLeftResizer, activeLayerIndex } = this.state

        if (!activeLayer) return

        const row = activeLayer.row
        const cursorSeconds = pixelsToSeconds(this.getSteppedPixels(x), this.props.timeScale)

        let start = activeLayer.startSeconds
        let duration = activeLayer.durationSeconds

        if (isLeftResizer) {
            start = cursorSeconds
            duration = (activeLayer.startSeconds+activeLayer.durationSeconds) - cursorSeconds
        } else {
            duration = cursorSeconds - start
        }

        const result = this.resizeLayer({
            activeLayerIndex,
            isLeftResizer,
            row,
            start,
            duration,
            resizingLayers, 
            resizingLimits, 
            maxSceneDuration,
            resizeMode: DYNAMIC_RESIZE_MODE
        })
        if (!result) return

        // # Resize Locally (not update redux)
        if (this.state.layers) {
            this.setState(prevState => ({
                ...prevState,
                layers: prevState.layers.map((layer, layerIndex) => {
                    if (result[layerIndex] == null) return layer
                    const data = result[layerIndex]
                    return {
                        ...layer,
                        row: data.row,
                        custom: {
                            ...data.custom,
                        }
                    }
                })
            }))
        }
    }

    getTempOffserStart(layerIndex) {
        if (layerIndex !== this.state.activeLayerIndex) return
        if (this.currentOffsetStart && this.state.isEditing) {
            return this.currentOffsetStart.offsetStart
        }
    }



    initAction(params) {
        const {isDrag, isResizing, isSliding, isLeftResizer, actionType, isDrop, dropLayerTrack } = params
        const activeLayerIndex = params.activeLayerIndex

        if (isDrop && !dropLayerTrack) return

        const places = isDrag ? this.getPlaces(activeLayerIndex) : null
        const coordsBetweenRows = isDrag ? this.getCoordsBetweenRows(activeLayerIndex, dropLayerTrack) : null

        this.resizingLayers = isResizing ? this.getLayersForResize(activeLayerIndex, isLeftResizer) : null
        this.resizingLimits = (isResizing || isSliding) ? this.getResizingLimits(activeLayerIndex, isLeftResizer) : null
        this.snapPoints = this.initSnapPoints(activeLayerIndex)


        // # Pause Timeline on edit start
        this.props.onSetTimelineData({
            playbackStatus: 0,
        })

        const layers = isDrop 
            ? [
                ...this.frame.forLayers,
                dropLayerTrack,
            ] 
            : this.frame.forLayers

        this.setState(prevState => ({
            ...prevState,
            isEditing: true,
            actionType,
            isLeftResizer,
            activeLayerIndex,
            layers: cloneDeep(layers),
            places,
            coordsBetweenRows,
            isResizing,
            dropLayerTrack,
            isDrop: true
        }))

        this.prevLayersLength = this.frame.forLayers.filter(layer => layer.show).length
    }


    onPointerMove = e => {
        e.stopPropagation()
        this.stopClicking(e)

        const { isEditing, actionType } = this.state
        if (!isEditing || !actionType) return

        if (actionType === this.actionTypes.DRAG || actionType === this.actionTypes.DROP) {
            this.drag(e)
        } else if (actionType === this.actionTypes.RESIZE) {
            this.resize(e)
        } else if (actionType === this.actionTypes.SLIDE) {
            this.slide(e)
        }
    }


    onPointerDown = e => {
        if (e.which != 1) return
        isMouseDown(true)
        this.isMouseDown = true

        // # clicked target
        const target = e.target
        if (!target) return
        let __actionType = target.dataset.actiontype
        let __layerId = target.dataset.layerid

        this.TLBgClicking = true
        this.TLBgClickingPosX = e.nativeEvent.x

        // # layer target
        const layerTarget = target.closest(".t-layer")
        if (!layerTarget) return

        if (!__actionType) {
            __actionType = layerTarget.dataset.actiontype
        }
        if (!__actionType) return

        this.currentOffsetStart = null
        this.moveTo = null

        const actionType = __actionType
        const isLoading = target.dataset.isloading
        const isDrag = actionType === this.actionTypes.DRAG
        const isResizing = actionType === this.actionTypes.RESIZE
        const isSliding = actionType === this.actionTypes.SLIDE
        const activeLayerIndex = parseInt(layerTarget.dataset.index)

        if (isLoading) return

        let isLeftResizer = false

        if (!isDrag) {
            if (target.dataset.resizertype === "left") {
                isLeftResizer = true
            }
        }

        window.addEventListener("pointerup", this.cancelEditing)
        window.addEventListener("pointermove", this.onPointerMove)
        
        this.setTimelineBounds()


        const targetRect = target.getBoundingClientRect()

        // # Shift on resizer click
        let shiftX = 0
        if (isResizing && !isLeftResizer) {
            shiftX = targetRect.width
        }
        
        this.options.targetX = e.clientX - targetRect.left - shiftX
        this.options.targetY = e.clientY - targetRect.top
        this.options.startClientY = e.clientY
        this.options.startClientX = e.clientX

        this.initAction({
            actionType,
            isDrag,
            isResizing,
            isSliding,
            isLeftResizer,
            activeLayerIndex,
            layerId: __layerId
        })
        
    
    }

    onClick = e => {
        if (e.which != 1) return
        if (!e.target) return

        // # Select Layer On Click
        if (!this.TLBgClicking) return
        if (e.target.classList[0] === "layer-audio-handler") return

        let __layerId = e.target.dataset.layerid
        if (!__layerId) {
            const layerTarget = e.target.closest(".t-layer")
            if (layerTarget) {
                __layerId = layerTarget.dataset.layerid
            }
        }

        if (!__layerId) return

        const { sceneType, trackId, frameIndex } = this

        // console.log("__layerId", __layerId)

        this.props.onSetEditorData({
            layerSelectingInitiator: "timeline",
            selectedTrackId: trackId,
            selectedElementId: __layerId,
            selectedElementType: sceneType,
            elementFrameIndex: frameIndex,
        })
        
    }


    updateLayerDuration = throttle(this.__updateLayerDuration, AUTO_UPDATE_LAYER_DURATION_THROTTLE)

    __updateLayerDuration(layerId) {
        if (!this.state.layersParams) return

        // # Хак для отмены, если только что редактирование происходило на Таймлайне
        if (this.resizingLayers || Date.now() - this.lastUpdateTime <= 500) return

        const { maxSceneDuration } = this
        // const { selectedElementId } = this.props.editor
        const layerParams = this.state.layersParams.find(item => {
            return item.layerId === layerId
        })
        if (!layerParams) return

        const { layerIndex } = layerParams
        const layerTrack = this.layers[layerIndex]
        if (!layerTrack) return  

        const layerState = getLayerState(this.props.elements, layerParams.layerId)
        if (!layerState) return

        const limits = resizingLimits(layerState, this.props, maxSceneDuration)
        const resizingLayers = this.getLayersForResize(layerIndex, false)

        // if (layerTrack.custom.duration <= limits.max) return

        const result = this.resizeLayer({
            activeLayerIndex: layerIndex,
            isLeftResizer: false,
            row: layerTrack.row,
            start: layerTrack.custom.start,
            duration: limits.isLoop 
                ? layerTrack.custom.duration 
                : CAN_INCREASE_DURATION_ON_PLAYBACK_RATE_CHANGE 
                    ? limits.max 
                    : layerTrack.custom.duration,
            resizingLayers, 
            resizingLimits: limits, 
            maxSceneDuration,
            resizeMode: DYNAMIC_RESIZE_MODE
        })

        // # Изменилась ли длительность редактируемого слоя
        const compareResult = result[layerIndex] &&
            result[layerIndex].custom.duration === layerTrack.custom.duration &&
            result[layerIndex].custom.start === layerTrack.custom.start

        if (compareResult) return

        // # makes new state
        const newLayers = this.layers.map((layer, index) => {
            if (result[index] == null) return layer
            const data = result[index]
            return {
                ...layer,
                row: data.row,
                custom: {
                    ...data.custom,
                }
            }
        })

        this.props.onUpdateSequenceLayers({
            trackId: this.trackId,
            frameIndex: this.frameIndex,
            data: newLayers,
        })
    }


    initLayersParamsThrottled = throttle(this.initLayersParams, INIT_LAYERS_PARAMS_THROTTLE)


    // # Check is track layers is equal to actual number of layers in elements state
    checkTrackLayersNumberEqualToSceneLayersNumber() {
        const { layers, frameLayers } = this
        
        if (layers.length !== frameLayers.length && frameLayers.length) {
            const deleteIndexes = layers
                .filter(layer => layer.index > frameLayers.length - 1)
                .map(layer => layer.index)

            if (deleteIndexes.length) {
                this.props.onUpdateSequenceLayers({
                    trackId: this.trackId,
                    frameIndex: this.frameIndex,
                    data: layers.filter(layer => !deleteIndexes.includes(layer.index))
                })
            }
        }
    }


    initLayersParams() {
        const { scene, frameLayers } = this
        if (!scene) return
        const result = []

        // # Check is track layers is equal to actual number of layers in elements state
        this.checkTrackLayersNumberEqualToSceneLayersNumber()

        frameLayers.forEach((layer, layerIndex) => {
            // console.log("layer", layer)
            if(!layer.items) return
            // # Определяем, высокий будет слой или нет
            const high = layer.items.find(item => 
                highItemTypes.includes(item.type) && 
                !item.isEffectItem && 
                !item.isMaskItem
            )
            result.push({
                layer,
                layerId: layer.id,
                layerIndex,
                high,
            })
        })

        this.setState(prevState => ({
            ...prevState,
            layersParams: result
        }))
    }


    renderHighlightPlace() {
        const { highlightPlace, activeLayerIndex, insertBeforeRowIndex } = this.state
        if (!highlightPlace || insertBeforeRowIndex != null) return null

        const activeLayer = this.calculatedLayers[activeLayerIndex]
        if (!activeLayer) return null
        const { start, duration } = highlightPlace

        // const pixelsPerDivision = this.props.timeScale.pixelsPerDivision
        // const selectorMinStepSeconds = this.props.timeScale.selectorMinStepSeconds
        // const pixelsToSeconds = (positionInPixels, pixelsPerDivision, selectorMinStepSeconds) => {
        //     return parseFloat((Math.round(positionInPixels / pixelsPerDivision / selectorMinStepSeconds) * selectorMinStepSeconds).toFixed(3))
        // }

        let startPx = layerStartPx(start, this.props.timeScale)

        // const steppedSeconds = pixelsToSeconds(startPx, pixelsPerDivision, selectorMinStepSeconds)
        // const steppedPixels = steppedSeconds * pixelsPerDivision

        // startPx = steppedPixels
        startPx = this.getSteppedPixels(startPx)

        const durationPx = duration == 0
            ? 0 /* between layers px */
            // : secondsToPixels(activeLayer.durationSeconds, this.props.timeScale)
            : secondsToPixels(this.smartInsertOnDragAndDrop ? duration : activeLayer.durationSeconds, this.props.timeScale)

        const style = {
            transform: `translateX(${startPx}px) translateY(${activeLayer.bounds.y}px)`,
            width: `${durationPx + 0}px`,
            height: `${this.getLayerHeight(activeLayer, activeLayerIndex) + 6}px`
        }
        const className = duration === 0 ? "t-put t-put-small" : "t-put"

        // ? orig without steps
        // const startSeconds = start + this.frame.start
        const startSeconds = pixelsToSeconds(this.getSteppedPixels(secondsToPixels(start + this.frame.start, this.props.timeScale)), this.props.timeScale)
        // console.log("startSeconds", pixelsToSeconds(this.getSteppedPixels(secondsToPixels(start + this.frame.start, this.props.timeScale)), this.props.timeScale))
        // const startSeconds = this.getSteppedPixels(secondsToPixels(start + this.frame.start, this.props.timeScale))
        const time = secondsToTime(startSeconds < 0 ? 0 : startSeconds, true)

        return <div className={className} style={style}>
            <div className="t-layer-drag-time">{time}</div>    
        </div>
    }

    renderBetweenRowsLine() {
        const { insertBeforeRowIndex } = this.state
        if (insertBeforeRowIndex == null) return null
        
        const height = 3

        const y = insertBeforeRowIndex * this.rowHeight
        const style = {
            height: `${height}px`,
            transform: `translateY(${y-height/2}px)`
        }
        return <div className="t-between-rows" style={style}></div>
    }

    // # Render Rows Lines
    renderRows() {
        const rows = []
        const { rowsNumber, rowHeight } = this
        for(let i=0; i<rowsNumber; i++) {
            const className = i % 2 === 0 ? "t-row t-row-a" : "t-row t-row-b"
            rows.push(<div className={className} style={{height: `${rowHeight}px`}}></div>)
        }
        return rows
    }

    renderSnapLine() {
        const { snapLine } = this.state
        if (!snapLine) return null
        const y = snapLine.startY
        const x = snapLine.startX
        const height = snapLine.endY
        const style = {
            height: `${height}px`,
            transform: `translateX(${x}px) translateY(${y}px)`
        }
        // console.log(style)
        return <div className="t-snap-line" style={style}></div>
    }

    
    // # Возвращаем к-во строк (rows) родительскому компоненту для подсчета высоты Таймлайна.
    // Делаем это таким способом, так как родительский компонент не знает о свойстве у слоя "show",
    // которое мы добавляем при переключении audioMode
    updateCurrentRowsNumber = (__layers) => {
        const layers = __layers || this.layers
        const filtered = layers.filter(layer => layer.show)
        this.props.onGetCurrentRowsNumber({
            rowsNumber: Math.max(...filtered.map(layer => layer.row)) + 1,
        })
    }


    reorderLayers() {
        // console.log("editor.dragMode", this.props.editor.dropPlace)
        const dropPlace = this.props.editor.dropPlace
        const layers = reorderLayers(this.layers, dropPlace)
        if (layers) {
            this.updateState("resize", layers)
        }
    }

    reorderRows(maxEmptyRows) {
        const layers = reorderRows(this.layers, maxEmptyRows)
        if (layers) {
            this.updateState("drag", layers, true)
        }
        this.updateCurrentRowsNumber(layers)
    }

    // # Удаляем ячейки в которых нет слоёв
    deleteFreeRows(row = null) {
        // # Проверка конкретной ячейки, и подтягивание нижних ячеек на row-1 позицию
        // # Это происходит после удаления слоя на Таймлайне
        if (row != null) {
            const layerInRow = this.layers.find(layer => layer.row === row && layer.show)
            // # Выходим, если в выбранной строке есть хотя бы один слой
            if (layerInRow) return
            const result = this.layers.map(layer => {
                if (layer.row <= row || !layer.show) return layer
                return {
                    ...layer,
                    row: layer.row - 1,
                }
            })
            this.updateState("drag", result, true)
        } else {
            // # Удаляем пустые ячейки по-порядку
            // # Это происходит при клике на кнопку очистки строк на панели Timeline/Tools
            this.reorderRows(0)
        }
    }

    initDropAction() {
        const dropLayerTrack = {
            row: 0,
            custom: {
                type: "custom",
                start: 0,
                // # В зависимости от масштаба Таймлайна будет разная длительность нового drag&drop слоя
                duration: this.props.timeScale.pixelsPerDivision > 46 ? 3 : 5
            },
        }
        // # Смещаем слой так, чтобы курсор был в центре
        this.options.targetX = secondsToPixels(dropLayerTrack.custom.duration, this.props.timeScale) / 2
        this.options.targetY = 10
        this.setTimelineBounds()
        window.removeEventListener("pointermove", this.onPointerMove)
        // window.removeEventListener("pointerup", this.cancelEditing)
        window.addEventListener("pointermove", this.onPointerMove)
        // window.addEventListener("pointerup", this.cancelEditing)
        this.initAction({
            actionType: "drop",
            isDrag: true,
            isResizing: false,
            isLeftResizer: false,
            activeLayerIndex: this.frame.forLayers.length,
            isDrop: true,
            dropLayerTrack
        })
    }


    // # Временно отключаем css анимацию transition для слоёв после удаления какого-либо слоя
    disableCSSAnimation() {
        this.setState(prevState => ({
            ...prevState,
            disableCSSAnimation: true
        }))

        const timerId = setTimeout(() => {
            this.setState(prevState => ({
                ...prevState,
                disableCSSAnimation: false
            }))
            clearTimeout(timerId)
        }, 750)
    }

    onShiftKeyStateChanged = () => {
        if (!this.props.shiftKeyPressed) {
            this.blockCursorPositionY = null
        }
    }


    componentWillUnmount() {
        window.removeEventListener("pointerup", this.cancelEditing)
        window.removeEventListener("pointermove", this.onPointerMove)
    }

    componentDidUpdate(prevProps, prevState) {
        const { editor, tracks } = this.props

        if (this.props.editor.audioMode !== prevProps.editor.audioMode) {
            this.updateCurrentRowsNumber()
        }

        // # Drag & Drop begin
        if (editor.dragMode !== prevProps.editor.dragMode) {
            if (!editor.dragMode) {
                this.deleteActionParams()
            }
        }
        if (editor.dragMode && editor.dropPlace !== prevProps.editor.dropPlace) {
            if (editor.dropPlace === 1 && editor.activeMediaLibrary) {
                // ? orig
                // this.initDropAction()
                // ? new :
                const layers = []
                if (this.state.layersParams) {
                    this.state.layersParams.forEach(data => {
                        if (data.layer) {
                            layers.push(data.layer)
                        }
                    })
                }
                // console.log("editor", editor)
                if (checkElementsCount(layers, this.props.onSetEditorData, editor.dragResourceId, editor.dragLayerType)) {
                    this.initDropAction()
                }
            } else {
                this.deleteActionParams()
            } 
        } else if (!editor.dragMode && editor.dragMode !== prevProps.editor.dragMode) {
            if (editor.dropPlace && editor.activeMediaLibrary) {
                const layers = []
                if (this.state.layersParams) {
                    this.state.layersParams.forEach(data => {
                        if (data.layer) {
                            layers.push(data.layer)
                        }
                    })
                }
                // ? old version of canceling if many layers of one type (like video)
                // if (checkElementsCount(layers, this.props.onSetEditorData)) {
                //     this.cancelEditing()
                // } else {
                //     this.deleteActionParams()
                // }
                this.cancelEditing()
                
            }
        }
        // # Drag & Drop end


        const layersLength = this.layers.length
        if (layersLength !== this.prevLayersLength && layersLength < this.prevLayersLength) {
            this.prevLayersLength = layersLength
            this.disableCSSAnimation()
        }

        if (tracks.clearFreeRowsStamp !== prevProps.tracks.clearFreeRowsStamp) {
            this.deleteFreeRows()
            return
        }

        if (tracks.lastDeletedLayer && tracks.lastDeletedLayer !== prevProps.tracks.lastDeletedLayer) {
            this.deleteFreeRows(tracks.lastDeletedLayer.row)
        } else if (tracks.reorderStamp !== prevProps.tracks.reorderStamp) {
            this.reorderRows()
            return
        }

        if (tracks.addLayerStamp !== prevProps.tracks.addLayerStamp) {
            this.reorderLayers()
            return
        }

        // # Update Timeline Bounds on Scroll
        if (this.props.timelineScroll !== prevProps.timelineScroll) {
            this.setTimelineBounds()
        }
        if (this.state.activeLayerIndex !== prevState.activeLayerIndex && prevState.activeLayerIndex != null) {
            this.cancelEditing()
        }
        if (this.props.elements !== prevProps.elements || tracks.stamp !== prevProps.tracks.stamp) {
            this.initLayersParamsThrottled()
        }

        if (this.state.layersParams !== prevState.layersParams) {
            this.updateLayerDuration(editor.selectedElementId)
        }

        if (this.props.shiftKeyPressed !== prevProps.shiftKeyPressed) {
            this.onShiftKeyStateChanged()
        }
        
    }

    componentDidMount() {
        this.initLayersParams()
        this.updateCurrentRowsNumber()

        if (this.props.editor.timelineDistanceMode == null) {
            this.props.onSetEditorData({
                timelineDistanceMode: 0
            })
        }
    }


    render() {
        const { frame } = this
        const layersContainerClassName = this.state.isEditing || this.state.disableCSSAnimation
            ? "t-layers t-layers-editing"
            : "t-layers"

        return <div className="timeline-elements-container" onPointerDown={this.onPointerDown} onClick={this.onClick}>
            
            <div className="timeline-el-wrapper" ref={node => this.timelineNode = node}>
                {frame && <div className="t-rows">{this.renderRows()}</div>}
                {frame && <div className={layersContainerClassName}>
                    {this.renderHighlightPlace()}
                    {this.renderBetweenRowsLine()}
                    {this.renderSnapLine()}
                    {this.calculatedLayers.map((layer, i) => 
                        layer.show ?
                        <Layer 
                            layer={layer}
                            index={i}
                            active={i === this.state.activeLayerIndex}
                            isResizing={this.state.isResizing}
                            isLeftResizer={this.state.isLeftResizer}
                            highlightedElementId={this.highlightedElementId}
                            selectedElementId={this.selectedElementId}
                            sceneType={this.sceneType}
                            sceneIndex={this.sceneIndex}
                            frameIndex={this.frameIndex}
                            frameStart={this.frame.start}
                            tempOffsetStart={this.getTempOffserStart(i)}
                        />
                        : null
                    )}
                </div>}
            </div>
        </div>
    }

}


export default connect(
    Frame.mapStateToProps,
    Frame.mapDispatchToProps
)(Frame)
