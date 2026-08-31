import Foundation

struct MovementFingerprint: Codable, Identifiable {
    let movementClass: MovementClass
    let sampleCount: Int
    let meanSpeedKmh: Double
    let p90SpeedKmh: Double
    let speedStdDevKmh: Double
    let stoppedShare: Double
    let stopsPerMinute: Double
    let accelMeanG: Double
    let accelP90G: Double
    let accelStdDevG: Double
    let rotationMeanRadS: Double
    let rotationP90RadS: Double
    let rotationStdDevRadS: Double
    let hardAccelPerMinute: Double
    let hardBrakePerMinute: Double
    let jerkRMSGPerSec: Double?
    let jerkP90GPerSec: Double?
    let vibrationLow: Double?
    let vibrationMid: Double?
    let vibrationHigh: Double?
    var id: String { movementClass.rawValue }
}

struct MovementMatch: Codable, Identifiable {
    let movementClass: MovementClass
    let distance: Double
    let confidence: Double
    let trainingSamples: Int
    var id: String { movementClass.rawValue }
}

enum MovementClassifier {
    static func fingerprints(from sessions: [MovementSession]) -> [MovementFingerprint] {
        let usable = sessions.filter { $0.movementClass != .unknown && $0.features != nil }
        return Dictionary(grouping: usable, by: \.movementClass).compactMap { movementClass, group in
            let f = group.compactMap(\.features)
            guard !f.isEmpty else { return nil }
            let dynamics = group.compactMap { IMUFeatureExtractor.extract($0.imuSamples ?? []) }
            return MovementFingerprint(movementClass: movementClass, sampleCount: f.count,
                meanSpeedKmh: mean(f.map(\.meanSpeedKmh)), p90SpeedKmh: mean(f.map(\.p90SpeedKmh)), speedStdDevKmh: mean(f.map(\.speedStdDevKmh)),
                stoppedShare: mean(f.map(\.stoppedShare)), stopsPerMinute: mean(f.map { perMinute(Double($0.stopCount), $0.durationSec) }),
                accelMeanG: mean(f.map(\.accelMeanG)), accelP90G: mean(f.map(\.accelP90G)), accelStdDevG: mean(f.map(\.accelStdDevG)),
                rotationMeanRadS: mean(f.map(\.rotationMeanRadS)), rotationP90RadS: mean(f.map(\.rotationP90RadS)), rotationStdDevRadS: mean(f.map(\.rotationStdDevRadS)),
                hardAccelPerMinute: mean(f.map { perMinute(Double($0.hardAccelEvents), $0.durationSec) }), hardBrakePerMinute: mean(f.map { perMinute(Double($0.hardBrakeEvents), $0.durationSec) }),
                jerkRMSGPerSec: optionalMean(dynamics.map(\.jerkRMSGPerSec)), jerkP90GPerSec: optionalMean(dynamics.map(\.jerkP90GPerSec)),
                vibrationLow: optionalMean(dynamics.map(\.vibrationLow)), vibrationMid: optionalMean(dynamics.map(\.vibrationMid)), vibrationHigh: optionalMean(dynamics.map(\.vibrationHigh)))
        }.sorted { $0.movementClass.rawValue < $1.movementClass.rawValue }
    }

    static func matches(features f: MovementFeatures, imuSamples: [IMUSample] = [], fingerprints: [MovementFingerprint]) -> [MovementMatch] {
        let dynamics = IMUFeatureExtractor.extract(imuSamples)
        return fingerprints.map { fp in
            var values: [(Double, Double, Double)] = [
                (f.meanSpeedKmh, fp.meanSpeedKmh, 15), (f.p90SpeedKmh, fp.p90SpeedKmh, 20), (f.speedStdDevKmh, fp.speedStdDevKmh, 10),
                (f.stoppedShare, fp.stoppedShare, 0.20), (perMinute(Double(f.stopCount), f.durationSec), fp.stopsPerMinute, 1.5),
                (f.accelMeanG, fp.accelMeanG, 0.08), (f.accelP90G, fp.accelP90G, 0.15), (f.accelStdDevG, fp.accelStdDevG, 0.08),
                (f.rotationMeanRadS, fp.rotationMeanRadS, 0.5), (f.rotationP90RadS, fp.rotationP90RadS, 1.0), (f.rotationStdDevRadS, fp.rotationStdDevRadS, 0.5),
                (perMinute(Double(f.hardAccelEvents), f.durationSec), fp.hardAccelPerMinute, 2.0), (perMinute(Double(f.hardBrakeEvents), f.durationSec), fp.hardBrakePerMinute, 2.0)
            ]
            if let d = dynamics {
                append(&values, d.jerkRMSGPerSec, fp.jerkRMSGPerSec, 2.0); append(&values, d.jerkP90GPerSec, fp.jerkP90GPerSec, 3.0)
                append(&values, d.vibrationLow, fp.vibrationLow, max(0.0005, (fp.vibrationLow ?? 0) * 0.75))
                append(&values, d.vibrationMid, fp.vibrationMid, max(0.0005, (fp.vibrationMid ?? 0) * 0.75))
                append(&values, d.vibrationHigh, fp.vibrationHigh, max(0.0005, (fp.vibrationHigh ?? 0) * 0.75))
            }
            let distance = sqrt(values.map { a,b,s in pow((a-b)/max(s,0.0001),2) }.reduce(0,+)/Double(values.count))
            let confidence = max(0,min(1,exp(-distance)*min(1,Double(fp.sampleCount)/5)))
            return MovementMatch(movementClass: fp.movementClass, distance: distance, confidence: confidence, trainingSamples: fp.sampleCount)
        }.sorted { $0.distance < $1.distance }
    }

    private static func append(_ values: inout [(Double,Double,Double)], _ current: Double, _ reference: Double?, _ scale: Double) { if let reference { values.append((current,reference,scale)) } }
    private static func perMinute(_ count: Double, _ duration: Double) -> Double { duration > 1 ? count*60/duration : 0 }
    private static func mean(_ a: [Double]) -> Double { a.isEmpty ? 0 : a.reduce(0,+)/Double(a.count) }
    private static func optionalMean(_ a: [Double]) -> Double? { a.isEmpty ? nil : mean(a) }
}
