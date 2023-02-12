
import { ITEM_TYPES } from "../../../Project/ProjectEditor/Scene/constants"
import getVideoOffset from "./getVideoOffset"


const ITEM_TYPES_WITH_OWN_DURATION = [
    ITEM_TYPES.MP4VIDEO, 
    ITEM_TYPES.MOVIN, 
    ITEM_TYPES.WEBMVIDEO, 
    ITEM_TYPES.ANIMATEDSPRITE,
    ITEM_TYPES.APNG,
    ITEM_TYPES.AUDIO
]



function resizingLimits(layer, props, currentMaxDuration, isLeftResizer) {
        const { videoOffsets, timeScale } = props
        const min = timeScale.effectMinimumDuration

        let limitByOffsetStart = false
        let offsetStart = 0
        let playbackRate = 1

        const defaultResult = {
            min,
            max: currentMaxDuration,
            offsetStart: 0,
            limitByOffsetStart,
        }

        // # Если item`ов больше одного, то не ограничиваем длительность слоя
        // if (layer.items.length > 1) {
        //     return defaultResult
        // }

        // # Если слой имеет хотя бы один item из этих типов, значит длительность может быть ограничена
        const itemsTypes = ITEM_TYPES_WITH_OWN_DURATION
        const foundItem = layer.items.find(item => itemsTypes.includes(item.type) && !item.isEffectItem && !item.isMaskItem)

        if (!foundItem) {
            // # Duration is unlimited
            return defaultResult
        }

        const itemType = foundItem.type
        let duration = currentMaxDuration
        let resourceId = foundItem.resourceId
        let isLoop = false

        // # Считаем максимально возможную длительность слоя для конкретных слоев, для которых этот параметр важен

        if (itemType === ITEM_TYPES.MP4VIDEO || itemType === ITEM_TYPES.WEBMVIDEO) {
            if (foundItem.mediaInfo && foundItem.video) {
                const loop = foundItem.video.loop
                isLoop = loop

                offsetStart = getVideoOffset(layer, foundItem, videoOffsets)
                limitByOffsetStart = true
                const __duration = layer.info && layer.info.mediaInfo ? layer.info.mediaInfo.duration : 0

                if (!__duration && foundItem.mediaInfo.duration > 0) {
                    duration = foundItem.mediaInfo.duration
                } else if (__duration) {
                    if (!loop) {
                        duration = __duration
                    }
                }
                
                if (foundItem.video.playbackRate != null) {
                    playbackRate = foundItem.video.playbackRate
                    duration = duration / playbackRate
                }

                if (!isLeftResizer) {
                    duration = duration - offsetStart
                }
            }
        } else if (itemType === ITEM_TYPES.MOVIN) {
            const isLayerHasText = layer.items.find(item => item.type === ITEM_TYPES.TEXT)
            if (foundItem.movin && !isLayerHasText) {
                const userSettings = foundItem.movin.userSettings || {}
                const loop = userSettings.loop ? userSettings.loop.value : foundItem.movin.loop
                isLoop = loop
                let __duration = layer.info && layer.info.mediaInfo ? layer.info.mediaInfo.duration : 0
                const FALLBACK_DURATION = 2

                if (!__duration && foundItem.movin.duration > 0) {
                    __duration = foundItem.movin.duration || FALLBACK_DURATION
                }

                const speed = userSettings.speed 
                    ? (userSettings.speed.value || 1) * (foundItem.movin.speed || 1) 
                    : foundItem.movin.speed || 1

                offsetStart = Math.abs(foundItem.movin.offsetStart || 0)
                limitByOffsetStart = true
                playbackRate = speed || 1.0

                if (!loop && duration) {
                    duration = __duration / playbackRate
                }
                if (!isLeftResizer) {
                    duration = duration - offsetStart
                }
            }
        } else if (itemType === ITEM_TYPES.ANIMATEDSPRITE) {
            if (foundItem[ITEM_TYPES.ANIMATEDSPRITE]) {
                offsetStart = getVideoOffset(layer, foundItem, videoOffsets)
                limitByOffsetStart = true
                const settings = foundItem[ITEM_TYPES.ANIMATEDSPRITE]
                const { loop } = settings
                isLoop = loop
                const __duration = foundItem.mediaInfo ? foundItem.mediaInfo.duration : 0
                if (settings.playbackRate != null) {
                    playbackRate = settings.playbackRate
                }
                
                if (!loop && __duration) {
                    duration = __duration / playbackRate
                }
                if (!isLeftResizer) {
                    duration = duration - offsetStart
                }
            }
        } else if (itemType === ITEM_TYPES.APNG) {
            if (foundItem.apng) {
                const userSettings = foundItem.apng.userSettings || {}
                const loop = userSettings.loop ? userSettings.loop.value : foundItem.apng.loop
                isLoop = loop
                const speed = userSettings.speed 
                    ? (userSettings.speed.value || 1) * (foundItem.apng.speed || 1) 
                    : foundItem.apng.speed || 1
                offsetStart = foundItem.apng.offsetStart || 0
                limitByOffsetStart = true
                playbackRate = speed
                if (!loop && foundItem.apng.duration) {
                    duration = foundItem.apng.duration / playbackRate - offsetStart
                }
            }
        } else if (itemType === ITEM_TYPES.AUDIO) {
            // console.log("audio", foundItem)
            if (foundItem.trackInfo) {
                offsetStart = getVideoOffset(layer, foundItem, videoOffsets)
                limitByOffsetStart = true

                if (foundItem.trackInfo.duration) {
                    duration = foundItem.trackInfo.duration
                }

                if (!isLeftResizer) {
                    duration = duration - offsetStart
                }
            }
        }

        return {
            min,
            max: duration,
            offsetStart,
            limitByOffsetStart,
            resourceId,
            layerId: layer.id,
            playbackRate,
            isLoop
        }
}

export default resizingLimits
