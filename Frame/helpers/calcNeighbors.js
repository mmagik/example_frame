
import { DISTANCE_MODES } from "../constants"

/* 
    Считаем позиции соседних слоёв в одной "row" при ресайзе
    (при ресайзе мы двигаем другие слои в строке сохраняя дистанцию друг между другом)
*/


function calcNeighbors(resizingLayers, newStart, newDuration, isLeftResizer, currentResult = {}, distanceMode = 0) {
    const result = currentResult

    if (resizingLayers && resizingLayers.length) {

        const firstNeighbor = resizingLayers[0]
        
        resizingLayers.forEach((layer, layerIndex) => {
            // # Shift Other Layer on the Left side
            if (isLeftResizer) {
                const firstNeighborDist = newStart - (firstNeighbor.custom.start + firstNeighbor.custom.duration )
                
                // # Move other layers with saving distances between each one
                const distance = layer.distance

                if (layerIndex === 0) {
                    const start = distanceMode === DISTANCE_MODES.SAVE_DISTANCE
                        ? newStart - distance - layer.custom.duration
                        : firstNeighborDist >= 0 ? layer.custom.start : layer.custom.start + firstNeighborDist

                    result[layer.index] = {
                        row: layer.row,
                        custom: {
                            // start: newStart - distance - layer.custom.duration,
                            // start: firstNeighborDist >= 0 ? layer.custom.start : layer.custom.start + firstNeighborDist,
                            start,
                            duration: layer.custom.duration
                        }
                    }
                } else {
                    const start = newStart - distance - layer.custom.duration
                    const distDiff = distanceMode === DISTANCE_MODES.SAVE_DISTANCE ? 0 : firstNeighbor.distance - firstNeighborDist
                    const distDiffShift = distDiff - firstNeighbor.distance

                    result[layer.index] = {
                        row: layer.row,
                        custom: {
                            start: start + distDiff - (distDiffShift > 0 ? distDiffShift : 0),
                            duration: layer.custom.duration
                        }
                    }
                }

            } else {
                // # Правый край слоя который ресайзим
                const end = newDuration + newStart
                // # Shift Other Layer on the Right side
                // # Move other layers with saving distances between each one
                const distance = layer.distance

                // # Текущая дистанция
                const firstNeighborDist = end - firstNeighbor.custom.start

                // # 
                if (layerIndex === 0) {
                    // Для первого соседа мы сокращаем дистанцию, пока они не столкнуться, далее начинаем двигать
                    const start = distanceMode === DISTANCE_MODES.SAVE_DISTANCE
                        ? end + distance
                        /* 
                            firstNeighborDist < 0 : если меньше 0, значит дистанция к слою еще есть,
                            в этом случае, у первого соседа остается своя позиция.
                            Когда дистанция исчерпается, то стартовая позиция первого соседа будет равна 
                            окончанию слоя, который ресайзится
                        */
                        : firstNeighborDist < 0 ? layer.custom.start : end

                    result[layer.index] = {
                        row: layer.row,
                        custom: {
                            start,
                            duration: layer.custom.duration
                        }
                    }
                } else {
                    // # Тут считаем движение других соседов
                    // Считаем стартовую позицию так, чтобы слои начали движение только тогда, когда активный слой столкнется с первым соседом.
                    // # @distDiff Разница текущей дистанции и дистанции до начала ресайза
                    const distDiff = distanceMode === DISTANCE_MODES.SAVE_DISTANCE ? 0 : firstNeighborDist + firstNeighbor.distance
                    const distDiffShift = firstNeighbor.distance - distDiff
                    result[layer.index] = {
                        row: layer.row,
                        custom: {
                            start: end + distance - distDiff - (distDiffShift < 0 ? distDiffShift : 0),
                            duration: layer.custom.duration
                        }
                    }
                }
                
            }
        })
    }

    return result

}


export default calcNeighbors
