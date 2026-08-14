import { Application } from 'pixi.js'

const app = new Application()
await app.init({
  width: 1200,
  height: 750,
  backgroundColor: 0x0a0a1a,
  antialias: true,
})
document.body.appendChild(app.canvas)
