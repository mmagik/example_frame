
import cloneDeep from "lodash/cloneDeep"

// # Максимальное к-во пустых строк, если не указано другое значение при выхове функции
const MAX_EMPTY_ROWS = 1


function reorderRows(layers, maxEmptyRows = MAX_EMPTY_ROWS) {
    if (!layers || layers.length === 0) return null

    const MAX_EMPTY_ROWS_IN_ORDER = maxEmptyRows

    const rowsNums = layers.filter(layer => layer.show).map(layer => layer.row)
    const minRow = Math.min(...rowsNums) 

    // # Делаем копию и запоминаем порядок слоя в массиве
    let layersCopy = cloneDeep(layers).map((layer, index) => {
        layer.index = index
        return layer
    })

    // # Убираем пустую ячейку сверху
    // Если сверху пустые ячейки то двигаем все слои выше
    const minRowMax = maxEmptyRows === 0 ? 0 : 1
    if (minRow > minRowMax) {
        // # move to top
        layersCopy.map(layer => {
            if (!layer.show) return layer
            layer.row = layer.row - minRow + minRowMax
            return layer
        })
    }

    // ? Отключено
    // # Если к-во слоёв меньше определенной величины, то не удалять строки
    // if (maxEmptyRows !== 0 && layers.length <= 3) return layersCopy


    // # Далее убираем ячейки, если их подряд больше чем N
    
    // # Сортируем слои по возрастанию ячейки, чтобы понимать где есть пропуски
    layersCopy.sort((a, b) => a.row - b.row)

    let shift = 0
    layersCopy = layersCopy.map((layer, i) => {
        if (i === 0 || !layer.show) return layer

        const prevRow = layers[layersCopy[i-1].index].row
        if (layer.row - prevRow > (MAX_EMPTY_ROWS_IN_ORDER + 1)) {
            shift = layer.row - prevRow - (MAX_EMPTY_ROWS_IN_ORDER + 1)
        }
        layer.row = layer.row - shift
        return layer
    })

    // # Сортируем слои обратно в оригинальном порядке
    layersCopy.sort((a, b,) => a.index - b.index)

    return layersCopy

}

export default reorderRows
