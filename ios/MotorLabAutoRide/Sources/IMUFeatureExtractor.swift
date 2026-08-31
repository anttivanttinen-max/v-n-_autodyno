import Foundation

struct IMUDynamicsFeatures: Codable {
    let sampleCount: Int
    let effectiveSampleHz: Double
    let jerkRMSGPerSec: Double
    let jerkP90GPerSec: Double
    let vibrationLow: Double
    let vibrationMid: Double
    let vibrationHigh: Double
}

enum IMUFeatureExtractor {
    static func extract(_ samples: [IMUSample]) -> IMUDynamicsFeatures? {
        guard samples.count >= 8 else { return nil }
        let sorted = samples.sorted { $0.timestamp < $1.timestamp }
        let duration = sorted.last!.timestamp.timeIntervalSince(sorted.first!.timestamp)
        guard duration > 0 else { return nil }
        let hz = Double(sorted.count - 1) / duration

        var jerk: [Double] = []
        jerk.reserveCapacity(sorted.count - 1)
        for i in 1..<sorted.count {
            let dt = sorted[i].timestamp.timeIntervalSince(sorted[i - 1].timestamp)
            guard dt > 0.02, dt < 1.0 else { continue }
            jerk.append(abs(sorted[i].motionMagnitude - sorted[i - 1].motionMagnitude) / dt)
        }

        let signal = sorted.map(\.motionMagnitude)
        return IMUDynamicsFeatures(
            sampleCount: sorted.count,
            effectiveSampleHz: hz,
            jerkRMSGPerSec: rms(jerk),
            jerkP90GPerSec: percentile(jerk, 0.90),
            vibrationLow: bandEnergy(signal, sampleHz: hz, lowHz: 0.5, highHz: 1.5),
            vibrationMid: bandEnergy(signal, sampleHz: hz, lowHz: 1.5, highHz: 3.0),
            vibrationHigh: bandEnergy(signal, sampleHz: hz, lowHz: 3.0, highHz: min(4.8, hz * 0.48))
        )
    }

    private static func bandEnergy(_ values: [Double], sampleHz: Double, lowHz: Double, highHz: Double) -> Double {
        guard values.count >= 8, sampleHz > 0, highHz > lowHz else { return 0 }
        let mean = values.reduce(0, +) / Double(values.count)
        let centered = values.map { $0 - mean }
        let n = centered.count
        var energy = 0.0
        var bins = 0
        for k in 1...(n / 2) {
            let frequency = Double(k) * sampleHz / Double(n)
            guard frequency >= lowHz, frequency < highHz else { continue }
            var re = 0.0
            var im = 0.0
            for i in 0..<n {
                let angle = 2.0 * Double.pi * Double(k * i) / Double(n)
                re += centered[i] * cos(angle)
                im -= centered[i] * sin(angle)
            }
            energy += (re * re + im * im) / Double(n * n)
            bins += 1
        }
        return bins == 0 ? 0 : energy / Double(bins)
    }

    private static func rms(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 0 }
        return sqrt(values.reduce(0) { $0 + $1 * $1 } / Double(values.count))
    }

    private static func percentile(_ values: [Double], _ p: Double) -> Double {
        guard !values.isEmpty else { return 0 }
        let sorted = values.sorted()
        let x = max(0, min(1, p)) * Double(sorted.count - 1)
        let lo = Int(floor(x)), hi = Int(ceil(x))
        if lo == hi { return sorted[lo] }
        let f = x - Double(lo)
        return sorted[lo] * (1 - f) + sorted[hi] * f
    }
}
