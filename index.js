var Service, Characteristic;
var mqtt    = require('mqtt');

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-mqtt-lux-tasmota", "mqtt-lux-tasmota", AmbientLightTasmotaAccessory);
}

function AmbientLightTasmotaAccessory(log, config) {
  this.log = log;
  this.name = config["name"] || "Sonoff";
  this.manufacturer = config['manufacturer'] || "ITEAD";
  this.model = config['model'] || "Sonoff";
  this.serialNumberMAC = config['serialNumberMAC'] || "";

  this.sensorPropertyName = config["sensorPropertyName"] || "Sensor";

  this.url = config['url'];
  this.topic = config['topic'];
  if (config["activityTopic"] !== undefined) {
     this.activityTopic = config["activityTopic"];
     this.activityParameter = config["activityParameter"];
  } else {
     this.activityTopic = "";
     this.activityParameter = "";
  }
  this.options = {
    keepalive: 10,
    clientId: this.client_Id,
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
	  
    will: {
      topic: 'WillMsg',
      payload: 'Connection Closed abnormally..!',
      qos: 0,
      retain: false
    },
    username: config["username"],
    password: config["password"],
    rejectUnauthorized: false
  };

  this.service = new Service.LightSensor(this.name);
  if(this.activityTopic !== "") {
    this.service.addOptionalCharacteristic(Characteristic.StatusActive)
  }

  this.client  = mqtt.connect(this.url, this.options);

  this.client.on('error', function () {
  that.log('Error event on MQTT');
  }
);

  this.client.on('connect', function () {
     if (config["startCmd"] !== undefined) {
         that.client.publish(config["startCmd"], config["startParameter"]);
     }
  }
);

  var that = this;
  this.client.subscribe(this.topic);
  if(this.activityTopic !== ""){
          this.client.subscribe(this.activityTopic);
  }

  this.client.on('message', function (topic, message) {
    if (topic == that.topic) {
                try {
                        data = JSON.parse(message);
                }
                catch (e) {
                  that.log("JSON problem");
                }
                that.light = 0;

                if (data.hasOwnPorperty("BH1750")) {
                        that.light = parseFloat(data.BH1750.Illuminance);
                } else if (data.hasOwnProperty(that.sensorPropertyName)) {
                                that.light = parseFloat(data[that.sensorPropertyName].Illuminance);
                } else {return null}
                that.service.setCharacteristic(Characteristic.CurrentAmbientLightLevel, that.light);
    } else if (topic == that.activityTopic) {
        var status = message.toString();
        that.activeStat = status == that.activityParameter;
        that.service.setCharacteristic(Characteristic.StatusActive, that.activeStat);
    }

  });

        this.service
            .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
            .on('get', this.getState.bind(this));

            if(this.activityTopic !== "") {
                        this.service
                                .getCharacteristic(Characteristic.StatusActive)
                                .on('get', this.getStatusActive.bind(this));
            }
}

AmbientLightTasmotaAccessory.prototype.getState = function(callback) {
    callback(null, this.light);
}

AmbientLightTasmotaAccessory.prototype.getStatusActive = function(callback) {
    callback(null, this.activeStat);
}


AmbientLightTasmotaAccessory.prototype.getServices = function() {

        var informationService = new Service.AccessoryInformation();

        informationService
                .setCharacteristic(Characteristic.Name, this.name)
                .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
                .setCharacteristic(Characteristic.Model, this.model)
                .setCharacteristic(Characteristic.SerialNumber, this.serialNumberMAC);

        return [informationService, this.service];
}
