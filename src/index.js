const SerialPort = require("serialport")
const Readline = require("@serialport/parser-readline")
const Blynk = require("blynk-library")
const Gpio = require("onoff").Gpio
const sunCalc = require("suncalc")

const AUTH = "VOgviAPpjrv3SaZATDB9Ig7G_2Fqh_OI"
const LAT = 25.421391
const LON = -101.000237
const TIME_ON = 15
const TIME_OFF = 45

const blynk = new Blynk.Blynk(AUTH)
const port = new SerialPort("/dev/ttyUSB0", { baudRate: 9600 })
const parser = port.pipe(new Readline())
const pump = new Gpio(18, "out")
const vPump = new blynk.VirtualPin(0)
const vTimerLabel = new blynk.VirtualPin(7)
const vTimer = new blynk.VirtualPin(1)
const sensors = { ec: 2, ph: 3, waterTemp: 4, hum: 5, temp: 6 }

function getTimeLeft(countdown) {
    const now = new Date().getTime()
    const distance = countdown - now
    const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    )
    const minutes = Math.ceil((distance % (1000 * 60 * 60)) / (1000 * 60))
    console.log(`${hours}h ${minutes}m`)
    vTimer.write(`${hours}h ${minutes}m`)
    return distance
}

function timer(callback, countdown) {
    // Update the count down every minute
    getTimeLeft(countdown)
    const x = setInterval(() => {
        const distance = getTimeLeft(countdown)
        if (distance <= 0) {
            clearInterval(x)
            callback()
        }
    }, 60000)
}

function getSunTimes(day) {
    const sunTimes = sunCalc.getTimes(day, LAT, LON)
    const offset = 2 * 60 * 60 * 1000 
    return [sunTimes.sunrise.getTime() + offset, sunTimes.sunset.getTime() - offset]
}

function startPump() {
    console.log("Starting pump...")
    vTimerLabel.write("Time to stop:")
    pump.writeSync(1)
    vPump.write(1)

    timer(() => {
        console.log("Stopping pump...")
        pump.writeSync(0)
        vPump.write(0)

        const curTime = new Date().getTime()
        const [sunrise, sunset] = getSunTimes(curTime)
        let nextWater = curTime + TIME_OFF * 60000
        if (nextWater >= sunset) {
            const tomorrow = new Date().setDate(new Date().getDate()+1) 
            nextWater = getSunTimes(tomorrow)[0]
        }
        vTimerLabel.write("Time to water:")
        timer(startPump, nextWater)
    }, new Date().getTime() + TIME_ON * 60000)
}

function start() {
    vPump.on("write", (param) => {
        if (param[0] == "1") {
            pump.writeSync(1)
        } else {
            pump.writeSync(0)
        }
    })

    parser.on("data", (line) => {
        const words = line.split(" ")
        const sensor = words[0]
        const value = words[1]

        blynk.virtualWrite(sensors[sensor], value)
    })

    const [sunrise, sunset] = getSunTimes(new Date())
    const curTime = new Date().getTime()
    if (curTime >= sunrise && curTime < sunset) {
        startPump()
    } else {
        let nextWater = sunrise
        if (curTime >= sunrise) {
            const tomorrow = new Date().setDate(new Date().getDate()+1) 
            nextWater = getSunTimes(tomorrow)[0]
        }
        vTimerLabel.write("Time to start:")
        timer(startPump, nextWater)
    }
}

blynk.on("connect", start) // Start when Blynk is ready

