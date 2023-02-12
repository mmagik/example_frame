
import React from "react"
import { connect } from "react-redux"
import MusicStripe from "./MusicStripe/"
import AudioEditor from "../../Layer/AudioEditor/"


import "./AudioPreview.css"

const AUDIO_STRIPE_HEIGHT = 35
const AUDIO_LAYER_TYPE = "soundtrack"


class AudioPreview extends React.Component {

    static mapStateToProps = state => {
        return {
            audio: state.audio,
            tracks: state.tracks,
            videoOffsets: state.videoOffsets,
            timeScale: state.timeScale,
            currentTime: state.currentTime
        }
    }

    get layerId() {
        return this.props.layerState.id
    }
    get item() {
        return this.props.layerState.items[0]
    }
    get duration() {
        return this.props.layerBounds.durationSeconds || 0
    }
    get start() {
        return this.props.layerBounds.startSeconds || 0
    }
    get width() {
        return this.props.layerBounds.bounds.width
    }
    get tracksStamp() {
        return this.props.tracks.stamp
    }
    get trackInfo() {
        return this.item.trackInfo
    }
    get isLoaded() {
        return this.props.layerState.isLoaded
    }
    get volume() {
        const { layerId } = this
        const { audio } = this.props
        return audio && audio.layers && audio.layers[layerId] != null
            ? audio.layers[layerId].volume
            : 1
    }
    get endOfVideoPx() {
        return this.props.currentTime.duration * this.props.timeScale.pixelsPerDivision
    }

    // getStripeHeight() {
    //     let { volume } = this
    //     if (volume < 0.2) {
    //         volume = 0.2
    //     }
    //     return {
    //         height: AUDIO_STRIPE_HEIGHT * volume,
    //         volume
    //     }
    // }
    getStripeHeight() {
        let { volume } = this
        // if (volume < 0.2) {
        //     volume = 0.2
        // }

        const stripeHeight = this.props.timeScale.rowHeight >= 38 ? AUDIO_STRIPE_HEIGHT : 26

        return {
            height: Math.max(4, stripeHeight * volume),
            volume
        }
    }

    getStripeProps() {
        const { pixelsPerDivision } = this.props.timeScale
        const { item, layerId } = this
        const { resourceId, trackInfo } = item
        let offsetStart = 0

        if (this.props.tempOffsetStart != null) {
            offsetStart = this.props.tempOffsetStart
        } else {
            offsetStart = this.props.videoOffsets && this.props.videoOffsets[layerId] ? this.props.videoOffsets[layerId][resourceId] : null
        }

        const stripeHeight = this.getStripeHeight()

        return {
            layerId,
            musicId: resourceId,
            resourceId,
            width: this.width,
            volume: stripeHeight.volume,
            height: stripeHeight.height,
            frameDuration: this.duration,
            frameStart: this.start,
            offsetStart,
            pixelsPerDivision,
            musicDuration: trackInfo.duration,
            mediaDuration: trackInfo.duration,
            tracksStamp: this.tracksStamp,
            type: "music"
        }
    }

    renderTrackInfo() {
        const { artist, trackName } = this.trackInfo

        if (!artist && !trackName) return null

        if (this.width < 70) return null

        return <div className="tl-audio-track-info">
            {trackName && <div className="mp-track-info-trackname">{trackName}</div>}
            {artist && <div className="mp-track-info-artist">{artist}</div>}
        </div>
    }

    shouldComponentUpdate(nextProps) {
        if (this.props.currentTime.time !== nextProps.currentTime.time) return false
        return true
    }

    get isShowAudio() {
        const { layerState } = this.props
        if (!layerState) return null
        if (layerState.layerType === AUDIO_LAYER_TYPE) return true
        if (layerState.info == null) return false

        if (layerState.info.mediaInfo != null && layerState.info.mediaInfo.audio) {
            return true
        }
    }


    renderHiddenPart() {
        const { width, endOfVideoPx } = this
        if ((width - start) <= endOfVideoPx) return null

        const start = endOfVideoPx - this.props.layerBounds.bounds.x + this.props.timeScale.scaleLeftMargin

        const style = {
            width: `${width - start}px`,
            transform: `translateX(${start}px)`
        }
        return <div className="tl-audio-hidden" style={style}></div>
    }


    render() {
        const { isLoaded } = this
        const stripeProps = this.getStripeProps()

        return <div className="tl-audio-preview">
            {/* {(this.isShowAudio) && <AudioEditor layerId={this.layerId} />} */}
            {/* {this.renderHiddenPart()} */}
            <div className="tl-audio-info">{this.renderTrackInfo()}</div>
            {!isLoaded && <div className="tl-audio-loading">Loading Audio</div>}
            {stripeProps 
                ? <MusicStripe {...stripeProps} />
                : <div>Audio</div>
            }
        </div>
    }
}


export default connect(
    AudioPreview.mapStateToProps,
    AudioPreview.mapDispatchToProps
)(AudioPreview)
