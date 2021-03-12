#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>

// Sensors
int waterTempPin = 11;
int DHTPin = 12;
int ECPin = A0;
int ECGround = A1;
int ECPower = A4;
int PhPin = A6;

OneWire oneWire(waterTempPin);       // Setup a oneWire instance to communicate with any OneWire devices
DallasTemperature sensors(&oneWire); // Pass our oneWire reference to Dallas Temperature.
DHT dht;

// ph constants
float m = -0.02244;
float b = 10.18357;

// ec constants
int R1 = 1000;
int Ra = 25; //Resistance of powering Pins

float PPMconversion = 0.7;
float TemperatureCoef = 0.019; //this changes depending on what chemical we are measuring
float K = 2.88;

float Temperature = 10;
float EC = 0;
float EC25 = 0;
int ppm = 0;

float raw = 0;
float Vin = 5;
float Vdrop = 0;
float Rc = 0;
float buffer = 0;
int chk;

float ph;
float wt;
float t;
float h;
char *str;

void GetEC()
{

  //*********Reading Temperature Of Solution *******************//
  sensors.requestTemperatures();            // Send the command to get temperatures
  Temperature = sensors.getTempCByIndex(0); //Stores Value in Variable
  wt += Temperature;

  //************Estimates Resistance of Liquid ****************//
  pinMode(ECPower, OUTPUT);  //Setting pin for sourcing current
  pinMode(ECGround, OUTPUT); //setting pin for sinking current
  delay(100);                // gives sensor time to settle

  digitalWrite(ECGround, LOW);
  digitalWrite(ECPower, HIGH);
  raw = analogRead(ECPin);
  raw = analogRead(ECPin); // This is not a mistake, First reading will be low beause if charged a capacitor
  digitalWrite(ECPower, LOW);

  pinMode(ECPower, INPUT);
  pinMode(ECGround, INPUT);

  //***************** Converts to EC **************************//
  Vdrop = (Vin * raw) / 1024.0;
  Rc = (Vdrop * R1) / (Vin - Vdrop);
  Rc = Rc - Ra; //acounting for Digital Pin Resitance
  EC = 1000 / (Rc * K);

  //*************Compensating For Temperaure********************//
  EC25 += EC / (1 + TemperatureCoef * (Temperature - 25.0));
  // ppm = (EC25) * (PPMconversion * 1000);
}

// This function sends Arduino's up time every second to Virtual Pin (5).
// In the app, Widget's reading frequency should be set to PUSH. This means
// that you define how often to send data to Blynk App.
void sensePh()
{
  ph = 0;
  t = 0;
  h = 0;
  for(int i = 0; i < 5; i++) {
    ph += analogRead(PhPin) * m + b; // Get Ph
    t += dht.getTemperature();
    h += dht.getHumidity();    
    delay(1000);
  }
  ph /= 5;
  t /= 5;
  h /= 5;
}

void senseEC()
{
  wt = 0;
  EC25 = 0;
  for (int i = 0; i < 5; i ++) {
    GetEC(); // sense EC
    delay(900);
  }
  wt /= 5;
  EC25 /= 5;
}

void setup()
{
  Serial.begin(9600);
  dht.setup(DHTPin);
  pinMode(ECPin, INPUT);
  pinMode(PhPin, INPUT);

  delay(100); // gives sensor time to settle
  sensors.begin();
  delay(100);

  R1 = (R1 + Ra); // Taking into acount Powering Pin Resitance
}

void loop()
{
  // Sense and send the EC for 5 secs, then the Ph for the next 5 secs, they can't be measured together
  senseEC();
  delay(5000);
  sensePh();
  Serial.print(wt);
  Serial.print(" ");
  Serial.print(ph);
  Serial.print(" ");
  Serial.print(EC25);
  Serial.print(" ");
  Serial.print(t);
  Serial.print(" ");
  Serial.println(h);
  delay(585000);
}
