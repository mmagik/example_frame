
export default function getVideoOffset(layer, item, videoOffsets = {}) {
    const layerId = layer.id
    const { resourceId } = item

    if (videoOffsets[layerId] && videoOffsets[layerId][resourceId] != null) {
        return videoOffsets[layerId][resourceId]
    }
    return 0
}
