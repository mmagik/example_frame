
import React from "react"
import secondsToTime from "../../../../helpers/secondsToTime2"


const SlideToolAction = props => {

    const offsetStart = props.offsetStart != null 
        ? secondsToTime(props.offsetStart, true)
        : null

    let offsetStartFormatted = null
    if (offsetStart != null) {
        offsetStartFormatted = `${offsetStart[0]}:${offsetStart[1]}.${offsetStart[2]}`
    }

    return <div className="t-layer-slide-action" data-actiontype="slide">
        {offsetStartFormatted != null && <div className="t-layer-slide-action-offset">-{offsetStartFormatted}</div>}
    </div>
}


export default SlideToolAction
