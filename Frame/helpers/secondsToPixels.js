
export default function secondsToPixels (positionInSeconds, timeScaleState) {
    const { pixelsPerDivision } = timeScaleState
    // return Math.round(positionInSeconds * pixelsPerDivision)
    return positionInSeconds * pixelsPerDivision
}