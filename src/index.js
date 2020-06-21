require('dotenv').config()
const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')
const Blynk = require('blynk-library')
const Gpio = require('onoff').Gpio
const sunCalc = require('suncalc')

const blynk = new Blynk.Blynk(procces.env.AUTH)
const port = new SerialPort('/dev/ttyUSB0', { baudRate: 9600 })
const parser = port.pipe(new Readline())
const pump = new Gpio(18, 'out')

const vPump = new blynk.VirtualPin(0)
const vPumpTimer = new blynk.VirtualPin(1)

const sensors = {
    ec: new blynk.VirtualPin(2),
    ph: new blynk.VirtualPin(3),
    waterTemp: new blynk.VirtualPin(4),
    hum: new blynk.VirtualPin(5),
    temp: new blynk.VirtualPin(6),
}

parser.on('data', (line) => {
    const words = line.split(' ')
    const sensor = words[0]
    const value = words[1]

    const vPin = sensors[sensor]
    vPin.write(value)
})

vPump.on('write', (param) => {
    if (param[0] == '1') {
        pump.writeSync(1)
    } else {
        pump.writeSync(0)
    }
})

const stopPump = function () {
    pump.writeSync(0)
    vPump.write(0)
    let timeToPump = 45
    vPumpTimer.write(timeToPump)
    for (; timeToPump > 0; timeToPump--) {
        setTimeout(() => {
            vPumpTimer.write(timeToPump)
        }, 60000)
    }
}

const startPump = function () {
    pump.writeSync(1)
    vPump.write(1)
    vPumpTimer.write(0)
    setTimeout(stopPump, 15 * 60000)
}

const waterTime = function (nTimes, sunSet) {
    for (let i = 1; i < nTimes; i++) {
        startPump()
        setTimeout(startPump, 60 * 60000)
    }
    vPumpTimer.write(999)
    const timeToMidnight = (24 - sunSet) * 60 * 60000
    setTimeout(checkSunTimes, timeToMidnight)
}

const checkSunTimes = function () {
    // It's 12 pm, check for new sunRise and sunSet
    const times = sunCalc.getTimes(new Date(), process.env.LAT, process.env.LON)
    const sunRise = times.sunrise.getHours() + 2
    const sunSet = times.sunset.getHours() - 1
    const afterXHours = sunRise * 60 * 60000
    const nTimes = sunSet - sunRise - 1
    setTimeout(waterTime, afterXHours, nTimes, sunSet)
}

const start = function () {
    const times = sunCalc.getTimes(new Date(), process.env.LAT, process.env.LON)
    const sunRise = times.sunrise.getHours() + 2
    const sunSet = times.sunset.getHours() - 1
    const curHour = new Date().getHours()

    if (curHour === 0) {
        checkSunTimes()
    }
    if (curHour < sunRise) {
        const afterXHours = sunRise - curHour * 60 * 60000
        const nTimes = sunSet - sunRise - 1
        setTimeout(waterTime, afterXHours, nTimes, sunSet)
    }
    if (curHour < sunSet) {
        const nTimes = sunSet - sunRise - 1 - curHour
        waterTime(nTimes, sunSet)
    } else {
        const afterXHours = 24 - curHour * 60 * 60000
        setTimeout(checkSunTimes, afterXHours)
    }
}

blynk.on('connect', start) // Start when Blynk is ready
