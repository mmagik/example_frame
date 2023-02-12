
import React from "react"
import { connect } from "react-redux"
import { setAudioVolume } from "../../../../../actions/audio"

import "./AudioEditor.css"


const DEFAULT_VOLUME = 0.94

class AudioEditor extends React.Component {

    editVolumeParentNode = null
    editVolumeNodePosY = 0
    editVolumeNodeOffsetY = 0


    state = {
        volume: DEFAULT_VOLUME
    }


    static mapStateToProps = (state) => {
        return {
            audio: state.audio,
            editor: state.editor,
            timeScale: state.timeScale,
        }
    }

    static mapDispatchToProps = (dispatch) => ({
        onSetAudioVolume(options, volume) {
            dispatch(setAudioVolume(options, volume))
        },
    })

    get volumeBarHeight() {
        return this.props.timeScale.rowHeight < 37
            ? 17
            : 30
    }

    get show() {
        return this.props.editor.audioMode
    }
    get audioSettings() {
        const { layerId, audio } = this.props
        if (audio && audio.layers && audio.layers[layerId]) {
            return audio.layers[layerId]
        }
    }

    get volume() {
        const { audioSettings } = this
        if (!audioSettings || audioSettings.volume == null) return DEFAULT_VOLUME
        return audioSettings.volume
    }

    componentDidMount() {
        document.addEventListener("pointerup", this.onEditVoumeEnd)
        this.init()
    }

    componentWillUnmount() {
        document.removeEventListener("pointermove", this.onEditVoume)
        document.removeEventListener("pointerup", this.onEditVoumeEnd)
    }


    init() {
        // # ... And that for video layers
        // Берем данные, если они есть, из redux состояния для конкретного слоя (по layerId)
        // const { layerId } = this.props
        // if (layerId) {
        //     if (this.props.audio.layers[layerId] && this.props.audio.layers[layerId].volume != null) {
        //         this.setState({
        //             volume: this.props.audio.layers[layerId].volume
        //         })
        //     }
        // }

        const { volume } = this
        this.setState({
            volume
        })
    }

    // # Get A Normalized Volume 0..1
    getVolume(pageY) {
        const cursorY = this.volumeBarHeight - (pageY - this.editVolumeNodePosY - this.editVolumeNodeOffsetY)
        const y = cursorY <= 0 ? 0 : (cursorY >= this.volumeBarHeight ? this.volumeBarHeight : cursorY)
        const volume = y / this.volumeBarHeight

        return volume
    }

    // # Save Volume To Redux state "audio" on pointer up
    saveVolume() {
        if (this.props.layerId) {
            this.props.onSetAudioVolume({
                type: "layers",
                layerId: this.props.layerId
            }, this.state.volume)
        }
    }

    // # Pointer Down
    onEditVoumeStart = event => {
        event.stopPropagation()
        document.addEventListener("pointermove", this.onEditVoume)

        this.isEdit = true

        // const startFromYlocal = (this.volumeBarHeight - this.state.volume * this.volumeBarHeight)
        this.editVolumeNodePosY = this.editVolumeParentNode.getBoundingClientRect().y 
        this.editVolumeNodeOffsetY = event.offsetY - 8

        const volume = this.getVolume(event.pageY)
        this.setState({
            volume
        })
    }

    // # Pointer Move
    onEditVoume = event => {
        // # Прерываем проброс события чтобы не двигать слой одновременно с редактированием громкости
        event.stopPropagation()

        const volume = this.getVolume(event.pageY)
        this.setState({
            volume
        })
    }

    // # Pointer Up
    onEditVoumeEnd = event => {
        
        document.removeEventListener("pointermove", this.onEditVoume)
        // # Save To Redux State
        if (this.isEdit) {
            this.saveVolume()
        }
        
        this.isEdit = false
    }


    render() {
        if (!this.show) return null

        const volume = this.isEdit ? this.state.volume : this.volume

        const className = "layer-audio"
        const handlerStyle = {
            transform: `translateY(${this.volumeBarHeight - this.volumeBarHeight * volume - 7}px)`
        }
        const highlightStyle = {
            height: `${volume * this.volumeBarHeight + 4}px`
        }
        
        return (
            <div className={className} ref={node=>this.editVolumeParentNode=node}>
                {/* <div className="layer-audio-level" style={highlightStyle}></div> */}
                {/* <div className="layer-audio-volume">{Math.round(volume * 100)} %</div> */}
                {/* <div className="layer-audio-handler" style={handlerStyle} onMouseDown={this.onEditVoumeStart}></div>
                <div className="layer-audio-highlight" style={highlightStyle}></div> */}
            </div>
        )
    }
}


export default connect(
    AudioEditor.mapStateToProps,
    AudioEditor.mapDispatchToProps
)(AudioEditor)
