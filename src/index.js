const SerialPort = require("serialport")
const Readline = require("@serialport/parser-readline")
const Blynk = require("blynk-library")
const Gpio = require("onoff").Gpio
const sunCalc = require("suncalc")
const { Client } = require('pg')

const AUTH = "VOgviAPpjrv3SaZATDB9Ig7G_2Fqh_OI"
const LAT = 25.421391
const LON = -101.000237

const client = new Client({
    user: 'jd@jdrs',
    host: 'jdrs.postgres.database.azure.com',
    database: 'postgres',
    password: 'Flotuss.1',
    port: 5432,
})
client.connect()

const text = 'INSERT INTO sensors(w_temperature, ph, ec, temperature, humidity) VALUES($1, $2, $3, $4, $5) RETURNING *'

const blynk = new Blynk.Blynk(AUTH)
const port = new SerialPort("/dev/ttyUSB0", { baudRate: 9600 })
const parser = port.pipe(new Readline())
const pump = new Gpio(18, "out")
// Virtual Pins
// 0 = waterTemp, 1 = ph, 2 = ec, 3 = temp, 4 = hum
const vPump = new blynk.VirtualPin(5)
const vTimerLabel = new blynk.VirtualPin(6)
const vTimer = new blynk.VirtualPin(7)
const vTimeOn = new blynk.VirtualPin(8)
const vTimeOff = new blynk.VirtualPin(9)
let timeOn = 15
let timeOff = 45

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
    return [
        sunTimes.sunrise.getTime() + offset,
        sunTimes.sunset.getTime() - offset,
    ]
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
        const sunset = getSunTimes(curTime)[1]
        let nextWater = curTime + timeOff * 60000
        if (nextWater >= sunset) {
            const tomorrow = new Date().setDate(new Date().getDate() + 1)
            nextWater = getSunTimes(tomorrow)[0]
        }
        vTimerLabel.write("Time to water:")
        timer(startPump, nextWater)
    }, new Date().getTime() + timeOn * 60000)
}

function start() {
    vPump.on("write", (param) => {
        if (param[0] == "1") {
            pump.writeSync(1)
        } else {
            pump.writeSync(0)
        }
    })

    vTimeOn.on("write", (param) => {
        timeOn = parseInt(param[0])
    })

    vTimeOff.on("write", (param) => {
        timeOff = parseInt(param[0])
    })

    parser.on("data", (line) => {
        const values = line.split(" ")
        client.query(text, values, (err, res) => {
            if (err) {
                console.log(err.stack)
            } else {
                console.log(res.rows[0])
            }
        })
        for (let i = 0; i < values.length; i++) {
            blynk.virtualWrite(i, values[i])
        }
    })

    vTimeOn.write(timeOn)
    vTimeOff.write(timeOff)
    const [sunrise, sunset] = getSunTimes(new Date())
    const curTime = new Date().getTime()
    if (curTime >= sunrise && curTime < sunset) {
        startPump()
    } else {
        let nextWater = sunrise
        if (curTime >= sunrise) {
            const tomorrow = new Date().setDate(new Date().getDate() + 1)
            nextWater = getSunTimes(tomorrow)[0]
        }
        vTimerLabel.write("Time to water:")
        timer(startPump, nextWater)
    }
}

blynk.on("connect", start) // Start when Blynk is ready
