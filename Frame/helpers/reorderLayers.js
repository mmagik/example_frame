
import cloneDeep from "lodash/cloneDeep"
import Config from "../../../../__Config/"
import { getCurrentPositionInSeconds } from "../../../Project/ProjectEditor/Scene/SceneObjects/Scene"


const { ENABLE_SMART_INSERT_PLACE, SMART_INSERT_MIN_DURATION_SECONDS } = Config.TIMELINE.FRAME


export function boundNewLayerInPlace(newLayer, place, __cursorPosition, minDuration) {
    let result = null

    const cursorPosition = Math.max(0, __cursorPosition, place ? place.start : 0)

    if (!place) return

    if (place.duration <= newLayer.duration) {
        result = {
            start: place.start,
            duration: place.duration,
            end: place.start + place.duration
        }
    } else {
        const startShift = cursorPosition - place.start
        const leftDuration = place.duration - startShift
        if (leftDuration < newLayer.duration) {
            const start = (place.start + place.duration) - newLayer.duration
            result = {
                start,
                duration: newLayer.duration,
                end: start + newLayer.duration
            }
        } else {
            result = {
                start: cursorPosition,
                duration: newLayer.duration,
                end: cursorPosition + newLayer.duration
            }
        }
    }

    if (result && minDuration) {
        if (result.duration < minDuration) {
            return null
        }
    }

    return result
}


function findPlace(__layers, newLayer) {
    if (!__layers || __layers.length < 2 || !newLayer) return

    let layers = cloneDeep(__layers)
    
    const { row } = newLayer
    const places = []
    const minDur = SMART_INSERT_MIN_DURATION_SECONDS

    layers = layers.filter((layer, i) => {
        return (
            // # Выбираем слои только из строки, в которую был вставлен новый слой
            layer.row === row &&
            // # Игнорируем последний элемент, так как это новый слой, который мы только что добавили на Таймлайн
            i < layers.length - 1 &&
            layer.show
        )
    })

    layers
        // # Сортируем слои в строке в порядке возростания стартовой позиции
        .sort((a,b) => a.custom.start-b.custom.start)
        .forEach((layer, i) => {
            const track = layer.custom
            // # Before Layers
            if (i === 0) {
                const duration = track.start
                if (duration >= minDur) {
                    places.push({
                        type: "start",
                        start: 0,
                        duration
                    })
                }
            }
            // # Between layers
            if (layers[i+1] !== undefined) {
                const nextLayer = layers[i+1]
                const nextLayerTrack = nextLayer.custom
                const start = track.start + track.duration
                const duration = nextLayerTrack.start - start
                if (duration >= minDur) {
                    places.push({
                        type: "between",
                        start,
                        duration
                    })
                }
            } else {
                // # Last Layer in row
                places.push({
                    type: "end",
                    start: layer.custom.start + layer.custom.duration,
                    duration: newLayer.custom.duration
                })
            }
        })


    // # Текущее закешированное значени положение селектора времени
    const cursorPosition = getCurrentPositionInSeconds()
    const foundPlace = places.find(place => {
        return cursorPosition >= place.start && cursorPosition < place.start + place.duration
    })

    return boundNewLayerInPlace(
        {
            start: newLayer.custom.start,
            duration: newLayer.custom.duration,
        }, 
        foundPlace,
        cursorPosition, 
    )
}



function reorderLayers(layers, dropOnRow) {
    if (!layers || layers.length <= 1) return

    // # Last Layer is a new added layer
    const lastLayerIndex = layers.length - 1
    const newLayer = layers[lastLayerIndex]

    const layersInRow = layers.filter((layer, index) => 
        layer.row === newLayer.row && index !== lastLayerIndex && layer.show
    )

    // # В той ячейке, в которую вставлен новый слой нет других слоёв, поэтому продолжаем вставку без доп. рассчетов
    // Также вставляем слой в выбранную ячейку без перестановки других слоев, если мы перетаскиваем слой (Drag&Drop)
    if (!layersInRow.length || dropOnRow != null) return null


    // # Ищем подходящее место для вставки взависимости от положения селектора и слоев в строках
    // Например, если в зоне селектора в самой верхней строке есть пустое место между слоями.
    const place = ENABLE_SMART_INSERT_PLACE ? findPlace(layers, newLayer) : null

    if (place) {
        return layers.map((layer, index) => {
            if (index === lastLayerIndex && layer.show) {
                return {
                    ...layer,
                    custom: {
                        ...layer.custom,
                        start: place.start,
                        duration: place.duration
                    }
                }
            }
            return layer
        })
    }

    // # Вставляем слой в новую строку вверху, над другими слоями, просто подвигаю все слои кроме нового на одну строку ниже
    return layers.map((layer, index) => {
        if (index === lastLayerIndex || !layer.show) return layer
        return {
            ...layer,
            row: layer.row + 1,
        }
    })

}

export default reorderLayers
