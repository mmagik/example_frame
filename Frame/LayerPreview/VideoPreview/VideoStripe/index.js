
import React from "react"
import { connect } from "react-redux"
import throttle from "lodash/throttle"
import VideoTiny from "../../../../../svg/VideoTiny"

import "./VideoStripe.css"


const DRAW_STRIPE_THROTTLING = 250
const ROW_WIDTH = 76
const ROW_HEIGHT = 36
const LEFT_PANEL_WIDTH = 443
const SCALE_LEFT_MARGIN = 24
const PAD_AT_START = 424
const PAD_AT_END = 400


class VideoStripe extends React.PureComponent {

    static mapStateToProps = state => {
        return {
            timelineScroll: state.timelineScroll
        }
    }

    canvas = null

    state = {
        stripeResourceReady: false,
        startDrawAt: 0,
    }


    // getVisiblePart() {
    //     const { timelineScroll, startSeconds } = this.props
    //     const scrollX = timelineScroll.scrollX || 0
    //     const ppd = this.props.pixelsPerDivision
    //     const endSeconds = startSeconds + this.props.frameDuration
    //     const startPx = startSeconds*ppd
    //     const endPx = endSeconds*ppd
    //     const padAtStart = PAD_AT_START + SCALE_LEFT_MARGIN
    //     const padAtEnd = PAD_AT_END
    //     const maxWidth = window.innerWidth - LEFT_PANEL_WIDTH

    //     // # Часть, в начале слоя, которая скрыта при прокрутке таймлайна
    //     const startDrawAt = Math.max(0, scrollX - startPx - padAtStart)
    //     // # Находится ли слой в пределах видииости
    //     const isOnScreen = scrollX < endPx + padAtStart && startPx-scrollX-padAtStart < maxWidth

    //     this.setState({
    //         startDrawAt: startDrawAt
    //     })

    //     return {
    //         startDrawAt: startDrawAt/ppd,
    //         isOnScreen,
    //         maxWidth: maxWidth + padAtEnd + padAtStart + this.props.offsetStart*ppd
    //     }
    // }


    async __drawStripe() {
        if (!this.canvas) return

        // const visiblePart = this.getVisiblePart(this.props.startSeconds)
        // if (!visiblePart.isOnScreen) return

        
        // let { startDrawAt, maxWidth } = visiblePart
        let { pixelsPerDivision: ppd, offsetStart, playbackOptions, stripeResource, MAX_CANVAS_WIDTH, canvasIndex } = this.props
        const manifest = this.props.manifest || {}
        let stripeData = null
    
        const canvasStart = this.props.canvasIndex * MAX_CANVAS_WIDTH
        const canvasEnd = canvasStart+MAX_CANVAS_WIDTH

        let hide = offsetStart*ppd + (this.props.timelineScroll.scrollX || 0) - this.props.startSeconds*ppd > canvasEnd

        if ((this.props.startSeconds*ppd - (this.props.timelineScroll.scrollX || 0) - window.innerWidth) > 0) {
            hide = true
        }

        if (hide) return

        // console.log({canvasIndex})
        // console.log({canvasIndex, canvasEnd: this.props.canvasIndex * MAX_CANVAS_WIDTH+MAX_CANVAS_WIDTH, offsetStart: offsetStart*ppd })

        if (!this.props.getFilmStrip) return

        const canvas = this.canvas
        const ctx = canvas.getContext("2d")

        try {
            stripeData = await this.props.getFilmStrip()
        } catch(error) {
            console.error(error)
            return
        }

        if (!stripeData || !stripeData.resource) return

        const scale = stripeData.scale || 1
        const rowWidth = ROW_WIDTH*scale
        const rowHeight = ROW_HEIGHT*scale
        const spriteWidth = stripeData.width * scale

        const playbackRate = playbackOptions.playbackRate || 1
        const duration = manifest.duration || this.props.duration
        const frameDuration = Math.ceil(this.props.frameDuration + offsetStart) + 5
        const loop = playbackOptions.loop ? playbackOptions.loop : false
        const loopReverse = playbackOptions.loopReverse ? playbackOptions.loopReverse : false

        let canvasesCount = frameDuration * ppd / (duration * ppd) * playbackRate
        canvasesCount = canvasesCount <= 1 ? 1 : canvasesCount
        let cols = Math.round(spriteWidth / rowWidth)
        let framesNum = Math.round((duration*rowWidth / rowWidth))

        const maxWidth = MAX_CANVAS_WIDTH
        const startDrawAt = 0

        const canvasStartSeconds = Math.floor(this.props.canvasIndex * MAX_CANVAS_WIDTH / ppd)

        let canvWidth = canvasesCount > 1 
            ? frameDuration * ppd * canvasesCount
            : frameDuration * ppd
            
        canvWidth -= startDrawAt*ppd
        canvWidth = Math.min(canvWidth, maxWidth) * scale
        
        canvas.width = canvWidth
        canvas.height = rowHeight
        canvas.style.width = canvWidth/scale + "px"
        canvas.style.height = rowHeight/scale + "px"

        const iterations = Math.ceil(canvasesCount)
        
        let end = Math.ceil(
            loop 
                ? frameDuration 
                : Math.min(framesNum/playbackRate, canvWidth/ppd/scale)
        ) * iterations

        end += startDrawAt + offsetStart

        const koef = ppd / rowWidth * scale

        const w = ROW_WIDTH
        const k = Math.ceil(startDrawAt*ppd/w)
        const tk = w*k - startDrawAt*ppd
        const tks = tk/ppd

        const startFrom = canvasStartSeconds
        const startDrawCorrect = (startDrawAt + tks)*playbackRate

        // ctx.clearRect(0,0, canvWidth, rowHeight)

        for (let loopIndex = 0; loopIndex < iterations; loopIndex++ ) {
            for (let i = startFrom; i <= end+canvasStartSeconds; i++) {         
                let second = i-startFrom
                // # Какой фрейм будем брать из картинки с раскадровкой
                // номер фрейма зависит от масштаба таймлайна и скорости воспроизведения
                let takeFrame = Math.min(
                    ((second+0) / koef * playbackRate - (framesNum * loopIndex)) + canvasStartSeconds*playbackRate,
                    framesNum
                )

                if (loopIndex > 0 && loop && loopReverse) {
                    if (loopIndex % 2 !== 0) {
                        takeFrame = framesNum - takeFrame + 1
                    }
                }

                const row = Math.ceil(takeFrame / cols),
                    col = Math.ceil(takeFrame) - (cols * (row - 1)),
                    frameIndex = second - 1,
                    rowIndex = row - 1,
                    colIndex = col - 1

                const sx = colIndex * rowWidth,
                    sy = rowIndex * rowHeight,
                    sWidth = rowWidth,
                    sHeight = rowHeight

                const dx = frameIndex * rowWidth,
                    dy = 0,
                    dWidth = rowWidth,
                    dHeight = rowHeight

                if (dx <= canvWidth) {
                    ctx.drawImage(stripeData.resource, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
                }
            }
        }

    }


    drawStripe = throttle(this.__drawStripe, DRAW_STRIPE_THROTTLING)


    onStripeUpdate = () => {
        this.setState(prevState => ({
            ...prevState,
            stamp: Math.random()
        }))
    }


    componentDidUpdate(prevProps, prevState) {
        if (prevProps.pixelsPerDivision !== this.props.pixelsPerDivision
            || prevProps.frameDuration !== this.props.frameDuration
            || prevProps.resourceId !== this.props.resourceId
            || prevProps.tracksStamp !== this.props.tracksStamp
            || prevProps.offsetStart !== this.props.offsetStart
            || prevProps.timelineScroll !== this.props.timelineScroll
            || prevProps.getFilmStrip !== this.props.getFilmStrip
            || prevState.stamp !== this.state.stamp) {
                this.drawStripe()
        }

    }

    componentDidMount() {
        this.drawStripe()
        if (this.props.resourceInstance && this.props.resourceInstance.addEventListener) {
            this.props.resourceInstance.addEventListener("onstripeupdate", this.onStripeUpdate)
        }

        this.props.stripeResource && this.props.stripeResource().then(() => {
            this.setState({
                stripeResourceReady: true
            })
            this.drawStripe()
        })
    }

    componentWillUnmount() {
        this.canvas = null
        if (this.props.resourceInstance && this.props.resourceInstance.removeEventListener) {
            this.props.resourceInstance.removeEventListener(this.onStripeUpdate)
        }
    }


    render() {
        const { offsetStart, pixelsPerDivision, MAX_CANVAS_WIDTH } = this.props
        // const { startDrawAt } = this.state // <- pixels

        // const oneFrameShift = ROW_WIDTH*Math.ceil(startDrawAt/ROW_WIDTH) - startDrawAt

        const style = {
            transform: `translateX(${-offsetStart*pixelsPerDivision}px)`,
            left: `${this.props.canvasIndex*MAX_CANVAS_WIDTH}px`
        }

        return <div className="video-stripe">
            <canvas style={style} ref={node => this.canvas = node} />
        </div>
        // return <canvas style={style} ref={node => this.canvas = node} />
    }
}

export default connect(
    VideoStripe.mapStateToProps,
    VideoStripe.mapDispatchToProps
)(VideoStripe)
