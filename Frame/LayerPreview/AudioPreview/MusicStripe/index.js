
import React, {Component} from "react"
import request, { USER_MUSIC_WAVE_LOAD } from "../../../../../../__Request/"

import "./MusicStripe.css"

/* 
    This component is for drawing the waveform for music in canvas
*/


const STRIPE_COLOR = "hsl(103, 36%, 51%)"
// const STRIPE_COLOR = "hsl(103, 36%, 51%)"
const AUDIO_STRIPE_HEIGHT = 35



class MusicStripe extends Component {

    canvas = null
    waveData = null
    musicDuration = 0
    dpr = 1


    // return real size depends on dpr
    parseSize(width, height) {
        return {
            width: width * this.dpr,
            height: height * this.dpr
        }
    }


    drawWave() {
        if (!this.waveData || !this.canvas) return

        let { frameDuration, musicId, pixelsPerDivision, offsetStart } = this.props
        let { width, height } = this.parseSize(this.props.width, this.props.height)
        let { musicDuration } = this
        let waveDataCount = this.waveData.data.length

        const ctx = this.canvas.getContext("2d")
        ctx.clearRect(0,0, width, height);
        ctx.beginPath()
        ctx.strokeStyle = "#fff"
        ctx.lineWidth = 1*this.dpr

        let offsetIndex = 0

        if (offsetStart == null) {
            offsetStart = 0
        }

        if (offsetStart > 0) {
            if (offsetStart - musicDuration >= 0.5) {
                offsetStart = 0.5
            }
            offsetIndex = Math.round(offsetStart * waveDataCount / musicDuration)
            if (offsetIndex % 2 > 0) {
                offsetIndex -= 1
            }
        }
        
        let samplesShowCount = Math.round(frameDuration * waveDataCount / musicDuration)
        let slicedPartToShow = this.waveData.data.slice(offsetIndex, samplesShowCount + offsetIndex)
        
        let showSamplesLength = Math.round(slicedPartToShow.length / 2)
        let slicedPartLength = slicedPartToShow.length

        let gap = 0

        if (musicDuration-offsetStart<=frameDuration) {
            gap = showSamplesLength * (pixelsPerDivision*(musicDuration-offsetStart)/showSamplesLength) / showSamplesLength
        } else {
            gap = showSamplesLength * (width/slicedPartLength) / showSamplesLength
        }

        let step = 2 // 4, 8, 6, 10 ...

        for (let i=0; i<=slicedPartLength; i+=step) {
            let topSample = slicedPartToShow[i+1]
            let bottomSample = slicedPartToShow[i]

            let lineStartY = height/2 * (1 - topSample)
            let lineHeight = height/2 + Math.abs(bottomSample) * (height/2)

            let x = Math.round(i*gap)

            const dis = Math.min(10,(1 - (this.props.volume >= 0.75 ? 1 : this.props.volume+0.25)) * 100)

            ctx.strokeStyle = `hsl(103, 32%, ${56-dis}%)`
            ctx.moveTo(x, lineHeight)
            ctx.lineTo(x, lineStartY)
            
        }
        ctx.stroke()
    }


    async requestWaveData() {
        let { musicId } = this.props
        let { width, height } = this.parseSize(this.props.width, this.props.height)
        let ctx = this.canvas.getContext("2d")
        ctx.clearRect(0,0, width, height);
        ctx = null

        try {
            const response = await request.post(USER_MUSIC_WAVE_LOAD, {
                params: {
                    resourceId: musicId
                }
            })

            if (response && response.data && response.data.waveData) {
                this.waveData = JSON.parse(response.data.waveData)
                this.musicDuration = response.data.duration
                this.drawWave()
            }

        } catch(error) {
            console.error(error)
        }

    }


    componentDidUpdate(prevProps) {
        if (prevProps.musicId !== this.props.musicId) {
            this.requestWaveData()
        } else {
            if (prevProps.width !== this.props.width
                || prevProps.height !== this.props.height
                || prevProps.offsetStart !== this.props.offsetStart) {
                    this.drawWave()
            }
        }
        
        
    }

    componentDidMount() {
        this.dpr = window.devicePixelRatio
        this.requestWaveData()
    }


    render() {
        let dpr = window.devicePixelRatio
        // width and height - it frame sizes
        let { width, height, musicId } = this.props
        let canvasRealWidth = width * dpr
        let canvasRealHeight = height * dpr

        let style = {
            width: width+"px",
            height: height+"px"
        }
        const volumeLevelStyle = {
            bottom: `${this.props.volume*100}%`
        }

        return (
            // <div className="music-stripe" style={{height: `${height}px`}}>
            <div className="music-stripe">
                <canvas ref={node => this.canvas = node} width={canvasRealWidth} height={canvasRealHeight} style={style} />
                <div className="music-stripe-vol-level" style={volumeLevelStyle}></div>
            </div>
        )
    }
}

export default MusicStripe