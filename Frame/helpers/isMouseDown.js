

export default function isMouseDown(mousedown) {
    if (mousedown) {
        document.documentElement.classList.add("unselectable")
    } else {
        document.documentElement.classList.remove("unselectable")
    }
}
