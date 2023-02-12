
import React from "react"
import { connect } from "react-redux"
import { ITEM_TYPES } from "../../../../Project/ProjectEditor/Scene/constants"
import { getResource } from "../../../../Project/ProjectEditor/Scene/ResourcesManager/"
import VideoStripe from "./VideoStripe/"
import EmptyPreview from "../EmptyPreview/"


const MAX_CANVAS_WIDTH = 9120


class VideoPreview extends React.Component {

    static mapStateToProps = state => {
        return {
            tracks: state.tracks,
            videoOffsets: state.videoOffsets,
            timeScale: state.timeScale,
            timelineScroll: state.timelineScroll
        }
    }

    get duration() {
        return this.props.layerBounds.durationSeconds || 0
    }
    get tracksStamp() {
        return this.props.tracks.stamp
    }

    get layerId() {
        return this.props.layerState.id
    }


    getStripeProps(item) {
        const { layerState } = this.props
        const { pixelsPerDivision } = this.props.timeScale
        const { info } = layerState
        const layerId = layerState.id
        const duration = info.mediaInfo.duration || 0
        const resourceId = item.resourceId
        let offsetStart = 0

        if (this.props.tempOffsetStart != null) {
            offsetStart = this.props.tempOffsetStart
        } else {
            offsetStart = this.props.videoOffsets && this.props.videoOffsets[layerId] ? this.props.videoOffsets[layerId][resourceId] : null
        }
        
        let playbackOptions = null
        if (this.props.isAnimatedSprite) {
            playbackOptions = item[ITEM_TYPES.ANIMATEDSPRITE]
        } else {
            playbackOptions = item.video
        }

        if (!playbackOptions) return null

        return {
            MAX_CANVAS_WIDTH,
            frameDuration: this.duration,
            pixelsPerDivision,
            resourceId,
            duration,
            playbackOptions,
            tracksStamp: this.tracksStamp,
            offsetStart,
            startSeconds: this.props.layerBounds.startSeconds
        }
    }

    renderEmptyPreview() {
        return <EmptyPreview layerId={this.layerId} title="Video" />
    }


    render() {
        const { layerState } = this.props
        const layerId = layerState.id
        let item = null

        if (this.props.isAnimatedSprite) {
            item = layerState.items.find(item => item.type === ITEM_TYPES.ANIMATEDSPRITE)
        } else {
            item = layerState.items.find(item => 
                (item.type === ITEM_TYPES.MP4VIDEO || item.type === ITEM_TYPES.WEBMVIDEO) &&
                !item.isEffectItem
            )
        }
        
        if (!item) return this.renderEmptyPreview()

        const resource = getResource(layerId, item.resourceId)
        if (resource == null) return this.renderEmptyPreview()

        if (!layerState.info || !layerState.info.mediaInfo || !layerState.info.mediaInfo.duration) {
            return this.renderEmptyPreview()
        }
        
        const stripeProps = this.getStripeProps(item)
        if (!stripeProps) return this.renderEmptyPreview()

        if (!resource.resourceDataItem || !resource.resourceDataItem.resourceInstance) return this.renderEmptyPreview() 
        const { resourceInstance } = resource.resourceDataItem

        const getCanvasesCount = () => {
            const { offsetStart, pixelsPerDivision } = stripeProps
            const scrollX = this.props.timelineScroll.scrollX || 0

            let duration = (stripeProps.frameDuration + offsetStart) * pixelsPerDivision

            duration = Math.min(
                window.innerWidth + scrollX + offsetStart * pixelsPerDivision, 
                duration
            )
    
            const count = Math.ceil(duration / stripeProps.MAX_CANVAS_WIDTH)
            return isNaN(count) ? 1 : count
        }

        const __canvasesCount = getCanvasesCount()

        let __canvases = []
        for(let i = 0; i < __canvasesCount; i++) {
            __canvases.push(i)
        }

        return <div className="video-stripe-wrapper">
            {__canvases.map(canvasIndex => {
                return <VideoStripe 
                    {...stripeProps} 
                    resourceInstance={resourceInstance} 
                    getFilmStrip={resource.getFilmStrip}
                    canvasIndex={canvasIndex}
                />
            })}
        </div>
    }
}


export default connect(
    VideoPreview.mapStateToProps,
    VideoPreview.mapDispatchToProps
)(VideoPreview)
