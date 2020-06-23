require('dotenv').config()
const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')
const Blynk = require('blynk-library')
const Gpio = require('onoff').Gpio
const sunCalc = require('suncalc')

const blynk = new Blynk.Blynk(process.env.AUTH)
const port = new SerialPort('/dev/ttyUSB0', { baudRate: 9600 })
const parser = port.pipe(new Readline())
const pump = new Gpio(18, 'out')
const vPump = new blynk.VirtualPin(0)
const vPumpTimer = new blynk.VirtualPin(1)
const sensors = { ec: 2, ph: 3, waterTemp: 4, hum: 5, temp: 6 }

function start() {
    let sunRise = 0,
        sunSet = 0,
        curTime = 0,
        nextWater = 0,
        timeToWater = false,
        pumpOn = false

    vPump.on('write', (param) => {
        if (param[0] == '1') {
            pump.writeSync(1)
        } else {
            pump.writeSync(0)
        }
    })

    parser.on('data', (line) => {
        const words = line.split(' ')
        const sensor = words[0]
        const value = words[1]

        blynk.virtualWrite(sensors[sensor], value)
    })

    function updateTimes() {
        const time = new Date()
        sunTimes = sunCalc.getTimes(time, process.env.LAT, process.env.LON)
        sunRise =
            (sunTimes.sunrise.getHours() + 2) * 60 +
            sunTimes.sunrise.getMinutes()
        sunSet =
            (sunTimes.sunset.getHours() - 2) * 60 + sunTimes.sunset.getMinutes()
        curTime = time.getHours() * 60 + time.getMinutes()
        nextWater = sunRise
        console.log('Updating times...')
        console.log('Current time:', time)
        console.log('Current time in minutes:', curTime)
    }

    function startPump() {
        console.log('Starting pump...')
        pumpOn = true
        pump.writeSync(1)
        vPump.write(1)
        vPumpTimer.write(0)
        setTimeout(() => {
            console.log('Stopping pump...')
            pumpOn = false
            pump.writeSync(0)
            vPump.write(0)
        }, 15 * 60000)
    }

    function sendTimeToPump() {
        const hours = parseInt(nextWater / 60)
        console.log(`Next watering time is at: ${hours}:${nextWater - 60 * hours}`)
        minToStart = curTime > nextWater ? minToStart = 24 * 60 - curTime + nextWater : nextWater - curTime
        console.log('Minutes to start watering:', minToStart)
        vPumpTimer.write(minToStart)
    }

    function controlWater() {
        if (curTime >= sunRise && curTime < sunSet && !timeToWater) {
            timeToWater = true
            startPump()
            if (curTime + 45 < sunSet) {
                nextWater = curTime + 45
                setTimeout(startPump, 60 * 60000)
            } else {
                nextWater = sunRise
                timeToWater = false
            }
        } else if (curTime === 24 * 60) {
            updateTimes()
        }
        if (!pumpOn) {
            sendTimeToPump()
        }
        curTime += 1
    }

    updateTimes()
    controlWater()
    setInterval(controlWater, 60000)
}

blynk.on('connect', start) // Start when Blynk is ready
