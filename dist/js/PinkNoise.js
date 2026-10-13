// https://forum.juce.com/t/pink-noise-generator/40013
class PinkNoiseProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super()
        this.b = []
        for (let i = 0; i < options.outputChannelCount; i++)
            this.b.push([0, 0, 0, 0, 0, 0, 0])
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0]
        for (let channelI = 0; channelI < output.length; channelI++) {
            const channel = output[channelI]
            const b = this.b[channelI]
            for (let i = 0; i < channel.length; i++) {
                const white = Math.random() * 2 - 1
                b[0] = 0.99886 * b[0] + white * 0.0555179
                b[1] = 0.99332 * b[1] + white * 0.0750759
                b[2] = 0.96900 * b[2] + white * 0.1538520
                b[3] = 0.86650 * b[3] + white * 0.3104856
                b[4] = 0.55000 * b[4] + white * 0.5329522
                b[5] = -0.7616 * b[5] - white * 0.0168980

                const pink = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + white * 0.5362
                channel[i] = pink * 0.11 // Idk where this 0.11 comes from, but it seems correct for keeping max <1
                b[6] = white * 0.115926
            }
        }
        return true
    }
}
registerProcessor("pink-noise-processor", PinkNoiseProcessor)