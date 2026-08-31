import Foundation
import CoreLocation
import CoreMotion
import Combine

enum MovementClass: String, Codable, CaseIterable, Identifiable {
    case moto = "MOTO"
    case bus = "BUS"
    case car = "CAR"
    case walk = "WALK"
    case stationary = "STATIONARY"
    case unknown = "UNKNOWN"
    var id: String { rawValue }
}

struct RidePoint: Codable {
    let timestamp: Date
    let latitude: Double
    let longitude: Double
    let speedKmh: Double
    let accuracyM: Double
    let accelerationX: Double?
    let accelerationY: Double?
    let accelerationZ: Double?
    let rotationX: Double?
    let rotationY: Double?
    let rotationZ: Double?
    let motionMagnitude: Double?
}

struct MovementFeatures: Codable {
    let durationSec: Double
    let pointCount: Int
    let maxSpeedKmh: Double
    let meanSpeedKmh: Double
    let medianSpeedKmh: Double
    let p90SpeedKmh: Double
    let speedStdDevKmh: Double
    let movingShare: Double
    let stoppedShare: Double
    let stopCount: Int
    let accelMeanG: Double
    let accelP90G: Double
    let accelP99G: Double
    let accelStdDevG: Double
    let rotationMeanRadS: Double
    let rotationP90RadS: Double
    let rotationStdDevRadS: Double
    let hardAccelEvents: Int
    let hardBrakeEvents: Int
}

struct MovementSession: Codable {
    let schema: String
    let id: String
    let startedAt: Date
    let endedAt: Date
    var movementClass: MovementClass
    var classSource: String
    var labeledAt: Date?
    var features: MovementFeatures?
    let points: [RidePoint]
}

@MainActor
final class AutoRideManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = AutoRideManager()

    @Published private(set) var status = "Valmis"
    @Published private(set) var rideActive = false
    @Published private(set) var pointCount = 0
    @Published private(set) var motionMagnitude = 0.0
    @Published private(set) var lastSessionId: String?
    @Published private(set) var lastSessionClass: MovementClass = .unknown
    @Published private(set) var lastSessionFeatures: MovementFeatures?

    private let manager = CLLocationManager()
    private let motionManager = CMMotionManager()
    private var latestMotion: CMDeviceMotion?
    private var movingHits = 0
    private var stoppedSince: Date?
    private var points: [RidePoint] = []
    private var sessionId: String?
    private var sessionStartedAt: Date?
    private let startSpeedKmh = 8.0
    private let requiredMovingHits = 3
    private let stopDelay: TimeInterval = 180

    override private init() {
        super.init()
        manager.delegate = self
        manager.activityType = .automotiveNavigation
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        configureStandby()
    }

    func start() {
        startMotionCapture()
        loadLastSessionSummary()
        manager.requestAlwaysAuthorization()
        if manager.authorizationStatus == .authorizedAlways { armStandby() }
        status = "Auto Ride valmiina"
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways:
            armStandby()
            status = "Auto Ride valmiina"
        case .authorizedWhenInUse:
            status = "Salli sijainti: Aina"
        case .denied, .restricted:
            status = "Sijaintilupa puuttuu"
        default:
            break
        }
    }

    private func startMotionCapture() {
        guard motionManager.isDeviceMotionAvailable, !motionManager.isDeviceMotionActive else { return }
        motionManager.deviceMotionUpdateInterval = 0.1
        motionManager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let self, let motion else { return }
            self.latestMotion = motion
            let a = motion.userAcceleration
            self.motionMagnitude = sqrt(a.x * a.x + a.y * a.y + a.z * a.z)
        }
    }

    private func configureStandby() {
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.distanceFilter = 25
        manager.pausesLocationUpdatesAutomatically = false
    }

    private func configureRideTracking() {
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = kCLDistanceFilterNone
        manager.pausesLocationUpdatesAutomatically = false
    }

    private func armStandby() {
        configureStandby()
        manager.startMonitoringSignificantLocationChanges()
        manager.startUpdatingLocation()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for location in locations where location.horizontalAccuracy >= 0 { consume(location) }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        status = "GPS: \(error.localizedDescription)"
    }

    private func consume(_ location: CLLocation) {
        let speed = max(0, location.speed * 3.6)
        if !rideActive {
            if speed >= startSpeedKmh && location.horizontalAccuracy <= 75 { movingHits += 1 }
            else { movingHits = max(0, movingHits - 1) }
            if movingHits >= requiredMovingHits { beginRide(at: location) }
            return
        }

        append(location)
        if speed < 2 {
            if stoppedSince == nil { stoppedSince = location.timestamp }
            if let stoppedSince, location.timestamp.timeIntervalSince(stoppedSince) >= stopDelay { finishRide() }
        } else { stoppedSince = nil }
    }

    private func beginRide(at location: CLLocation) {
        rideActive = true
        movingHits = 0
        stoppedSince = nil
        points = []
        sessionId = UUID().uuidString.lowercased()
        sessionStartedAt = location.timestamp
        configureRideTracking()
        manager.startUpdatingLocation()
        append(location)
        status = "LIIKE TALLENTUU • UNKNOWN"
        NotificationCenter.default.post(name: .motorLabRideStarted, object: nil)
    }

    private func append(_ location: CLLocation) {
        let motion = latestMotion
        let a = motion?.userAcceleration
        let r = motion?.rotationRate
        let mag = a.map { sqrt($0.x * $0.x + $0.y * $0.y + $0.z * $0.z) }
        points.append(RidePoint(timestamp: location.timestamp,
                                latitude: location.coordinate.latitude,
                                longitude: location.coordinate.longitude,
                                speedKmh: max(0, location.speed * 3.6),
                                accuracyM: location.horizontalAccuracy,
                                accelerationX: a?.x,
                                accelerationY: a?.y,
                                accelerationZ: a?.z,
                                rotationX: r?.x,
                                rotationY: r?.y,
                                rotationZ: r?.z,
                                motionMagnitude: mag))
        pointCount = points.count
        persistCurrentRide()
    }

    private func finishRide() {
        guard rideActive else { return }
        rideActive = false
        stoppedSince = nil
        persistCompletedRide()
        points = []
        pointCount = 0
        sessionId = nil
        sessionStartedAt = nil
        armStandby()
        status = "Auto Ride valmiina"
        NotificationCenter.default.post(name: .motorLabRideStopped, object: nil)
    }

    func labelLastSession(_ movementClass: MovementClass) {
        guard let id = lastSessionId else { return }
        let url = ridesDirectory.appendingPathComponent("session-\(id).json")
        guard let data = try? Data(contentsOf: url), var session = try? JSONDecoder().decode(MovementSession.self, from: data) else { return }
        session.movementClass = movementClass
        session.classSource = "user"
        session.labeledAt = Date()
        if session.features == nil { session.features = summarize(session.points, startedAt: session.startedAt, endedAt: session.endedAt) }
        guard let out = try? JSONEncoder().encode(session) else { return }
        try? out.write(to: url, options: .atomic)
        lastSessionClass = movementClass
        lastSessionFeatures = session.features
        UserDefaults.standard.set(id, forKey: "MotorLabLastMovementSessionId")
    }

    private var ridesDirectory: URL {
        let base = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("MotorLabMovementSessions", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private func persistCurrentRide() {
        guard let id = sessionId, let startedAt = sessionStartedAt else { return }
        let now = Date()
        let session = MovementSession(schema: "motorlab_movement_session_v2", id: id, startedAt: startedAt, endedAt: now, movementClass: .unknown, classSource: "unlabeled", labeledAt: nil, features: summarize(points, startedAt: startedAt, endedAt: now), points: points)
        guard let data = try? JSONEncoder().encode(session) else { return }
        try? data.write(to: ridesDirectory.appendingPathComponent("current.json"), options: .atomic)
    }

    private func persistCompletedRide() {
        guard !points.isEmpty, let id = sessionId, let startedAt = sessionStartedAt else { return }
        let endedAt = Date()
        let features = summarize(points, startedAt: startedAt, endedAt: endedAt)
        let session = MovementSession(schema: "motorlab_movement_session_v2", id: id, startedAt: startedAt, endedAt: endedAt, movementClass: .unknown, classSource: "unlabeled", labeledAt: nil, features: features, points: points)
        guard let data = try? JSONEncoder().encode(session) else { return }
        try? data.write(to: ridesDirectory.appendingPathComponent("session-\(id).json"), options: .atomic)
        try? FileManager.default.removeItem(at: ridesDirectory.appendingPathComponent("current.json"))
        lastSessionId = id
        lastSessionClass = .unknown
        lastSessionFeatures = features
        UserDefaults.standard.set(id, forKey: "MotorLabLastMovementSessionId")
    }

    private func loadLastSessionSummary() {
        guard let id = UserDefaults.standard.string(forKey: "MotorLabLastMovementSessionId") else { return }
        let url = ridesDirectory.appendingPathComponent("session-\(id).json")
        guard let data = try? Data(contentsOf: url), let session = try? JSONDecoder().decode(MovementSession.self, from: data) else { return }
        lastSessionId = session.id
        lastSessionClass = session.movementClass
        lastSessionFeatures = session.features ?? summarize(session.points, startedAt: session.startedAt, endedAt: session.endedAt)
    }

    private func summarize(_ points: [RidePoint], startedAt: Date, endedAt: Date) -> MovementFeatures {
        let speeds = points.map(\.speedKmh)
        let motion = points.compactMap(\.motionMagnitude)
        let rotation = points.compactMap { p -> Double? in
            guard let x = p.rotationX, let y = p.rotationY, let z = p.rotationZ else { return nil }
            return sqrt(x*x + y*y + z*z)
        }
        let duration = max(0, endedAt.timeIntervalSince(startedAt))
        let moving = speeds.filter { $0 >= 3 }.count
        let stopped = speeds.filter { $0 < 2 }.count
        var stopCount = 0, inStop = false
        for v in speeds {
            if v < 2 { if !inStop { stopCount += 1; inStop = true } }
            else if v >= 4 { inStop = false }
        }
        var hardAccel = 0, hardBrake = 0
        if points.count > 1 {
            for i in 1..<points.count {
                let dt = points[i].timestamp.timeIntervalSince(points[i-1].timestamp)
                if dt <= 0 || dt > 10 { continue }
                let a = ((points[i].speedKmh - points[i-1].speedKmh) / 3.6) / dt
                if a >= 2.0 { hardAccel += 1 }
                if a <= -2.5 { hardBrake += 1 }
            }
        }
        return MovementFeatures(durationSec: duration,
                                pointCount: points.count,
                                maxSpeedKmh: speeds.max() ?? 0,
                                meanSpeedKmh: mean(speeds),
                                medianSpeedKmh: percentile(speeds, 0.50),
                                p90SpeedKmh: percentile(speeds, 0.90),
                                speedStdDevKmh: stddev(speeds),
                                movingShare: speeds.isEmpty ? 0 : Double(moving) / Double(speeds.count),
                                stoppedShare: speeds.isEmpty ? 0 : Double(stopped) / Double(speeds.count),
                                stopCount: stopCount,
                                accelMeanG: mean(motion),
                                accelP90G: percentile(motion, 0.90),
                                accelP99G: percentile(motion, 0.99),
                                accelStdDevG: stddev(motion),
                                rotationMeanRadS: mean(rotation),
                                rotationP90RadS: percentile(rotation, 0.90),
                                rotationStdDevRadS: stddev(rotation),
                                hardAccelEvents: hardAccel,
                                hardBrakeEvents: hardBrake)
    }

    private func mean(_ a: [Double]) -> Double { a.isEmpty ? 0 : a.reduce(0,+) / Double(a.count) }
    private func stddev(_ a: [Double]) -> Double {
        guard a.count > 1 else { return 0 }
        let m = mean(a)
        return sqrt(a.reduce(0) { $0 + ($1-m)*($1-m) } / Double(a.count))
    }
    private func percentile(_ a: [Double], _ p: Double) -> Double {
        guard !a.isEmpty else { return 0 }
        let s = a.sorted(), x = max(0,min(1,p))*Double(s.count-1), lo = Int(floor(x)), hi = Int(ceil(x))
        if lo == hi { return s[lo] }
        let f = x-Double(lo)
        return s[lo]*(1-f)+s[hi]*f
    }
}

extension Notification.Name {
    static let motorLabRideStarted = Notification.Name("MotorLabRideStarted")
    static let motorLabRideStopped = Notification.Name("MotorLabRideStopped")
}
