
import { DISTANCE_MODES } from "../constants"


function calcResizeMaxDuration(resizingLayers, params) {
    /* 
        @resizingLayers: другие слои в строке, кроме слоя который ресайзим
    */
    let maxDuration = maxSceneDuration

    const { maxSceneDuration, 
        start,
        end,
        isLeftResizer,
        isDynamicResizeMode,
        distanceMode } = params

    if (!resizingLayers || !resizingLayers.length) return Infinity

    
    // # Соседние слои отосортированы по возростанию дистанции до них, выбираем самый дальний
    const lastNeighbor = resizingLayers[resizingLayers.length - 1]
    // # Самый близкий соседний слой 
    const firstNeighbor = resizingLayers[0]


    if (isDynamicResizeMode) {
        if (isLeftResizer) {
            // при ресайзе влево, нужно, чтобы самый первый слой в строке (самый дальний сосед) не вышел за пределы сцены слева (0 секунд)
            const max = end - (lastNeighbor.distance + lastNeighbor.custom.duration)
            /* 
                Посколько между соседним слоем мы не сохраняем дистанцию, то добавляем её тоже к макс. длительности
            */
            maxDuration = distanceMode === DISTANCE_MODES.SAVE_DISTANCE 
                ? max 
                : max + Math.max(firstNeighbor.distance, 0)
        } else {
            // # Самый дальний сосед справа не должен выйти за пределы макс. разрешенной длительности сцены
            const max = (maxSceneDuration - lastNeighbor.distance - lastNeighbor.custom.duration) - start
            maxDuration = max + Math.max(firstNeighbor.distance, 0)
        }
    } else {
        if (isLeftResizer) {
            // # Ограничиваем слева (активный слой упирается в левый край соседнего слоя)
            maxDuration = end - (firstNeighbor.custom.start + firstNeighbor.custom.duration)
        } else {
            // # Ограничиваем справа (активный слой при ресайзе упирается в левый край соседнего слоя)
            maxDuration = firstNeighbor.custom.start - start
        }
    }

    return maxDuration
    
}

export default calcResizeMaxDuration
