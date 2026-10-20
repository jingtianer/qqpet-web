import type { QQPetApi } from '../shared/ipc'
import type { SaveData, SavePatch, Sex } from '../shared/save'
import { applyPatch, buried, startSave } from '../shared/save-logic'

const STORAGE_KEY = 'qqpet.save'

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value))
}

function readSave(): Record<string, unknown> | null {
    const text = localStorage.getItem(STORAGE_KEY)
    if (!text) return null
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}

let save: SaveData = startSave(readSave())

function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
}

const noop = () => { }

const cursorListeners: Array<(p: { x: number; y: number }) => void> = []
window.addEventListener('pointermove', (event) => {
    const point = { x: event.clientX, y: event.clientY }
    cursorListeners.forEach((listener) => listener(point))
})

window.qqpet = {
    capabilities: {
        rotatableScreen: true,
        autoStart: false,
        clipboardWatch: false,
        frontWatch: false,
    },

    async load() {
        return clone(save)
    },

    save(patch: SavePatch) {
        applyPatch(save, clone(patch))
        persist()
    },

    resetPet(sex?: Sex) {
        save = buried(save, sex)
        persist()
        location.reload()
    },

    async exportSave() {
        const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `QQPet-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        return true
    },

    async importSave() {
        throw new Error('浏览器嵌入版暂未实现导入存档')
    },

    openGame(swf: string) {
        window.open(`./game.html?swf=${encodeURIComponent(swf)}`, '_blank')
    },

    calendar: async () => [],
    aiModels: async () => [],
    aiChat: async () => '',
    webSearch: async () => [],
    weather: async () => {
        throw new Error('浏览器嵌入版暂未实现天气')
    },
    latestRelease: async () => {
        throw new Error('浏览器嵌入版暂未实现更新检查')
    },

    quit: noop,
    copyText: (text: string) => void navigator.clipboard?.writeText(text),
    openUrl: (url: string) => window.open(url, '_blank'),
    setClickThrough: noop,
    setAlwaysOnTop: noop,
    setFocusable: noop,
    setAutoStart: noop,
    setTrayState: noop,

    onCursor(listener) {
        cursorListeners.push(listener)
    },
    onTrayClick: noop,
    onGamePlayed: noop,
    onClipboard: noop,
    onPresence: noop,
    onFront: noop,
} satisfies QQPetApi

window.__qqpetReady = Promise.resolve()