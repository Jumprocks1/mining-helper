// TODO I copied this from some garbage AI response
// Should be able to improve it significantly
class PinkNoiseProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // Initialize 7 random state variables for Kellet's refinement
        this.b0 = 0.0;
        this.b1 = 0.0;
        this.b2 = 0.0;
        this.b3 = 0.0;
        this.b4 = 0.0;
        this.b5 = 0.0;
        this.b6 = 0.0;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];

        // Process each audio channel (typically mono or stereo)
        for (let channel = 0; channel < output.length; channel++) {
            const outputBuffer = output[channel];

            for (let i = 0; i < outputBuffer.length; i++) {
                let white = Math.random() * 2 - 1; // Generate white noise (-1.0 to 1.0)

                // Paul Kellet's -3dB/octave filter approximation
                this.b0 = 0.99886 * this.b0 + white * 0.0555179;
                this.b1 = 0.99332 * this.b1 + white * 0.0750759;
                this.b2 = 0.96900 * this.b2 + white * 0.1538520;
                this.b3 = 0.86650 * this.b3 + white * 0.3104856;
                this.b4 = 0.55000 * this.b4 + white * 0.5329522;
                this.b5 = -0.7616 * this.b5 - white * 0.0168980;

                let pink = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362;
                this.b6 = white * 0.115926;
                outputBuffer[i] = pink * 0.11;
            }
        }
        return true; // Keep the processor alive
    }
}
registerProcessor("pink-noise-processor", PinkNoiseProcessor);