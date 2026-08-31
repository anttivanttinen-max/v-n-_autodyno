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

struct MovementSession: Codable {
    let schema: String
    let id: String
    let startedAt: Date
    let endedAt: Date
    var movementClass: MovementClass
    var classSource: String
    var labeledAt: Date?
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
        guard let out = try? JSONEncoder().encode(session) else { return }
        try? out.write(to: url, options: .atomic)
        lastSessionClass = movementClass
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
        let session = MovementSession(schema: "motorlab_movement_session_v1", id: id, startedAt: startedAt, endedAt: Date(), movementClass: .unknown, classSource: "unlabeled", labeledAt: nil, points: points)
        guard let data = try? JSONEncoder().encode(session) else { return }
        try? data.write(to: ridesDirectory.appendingPathComponent("current.json"), options: .atomic)
    }

    private func persistCompletedRide() {
        guard !points.isEmpty, let id = sessionId, let startedAt = sessionStartedAt else { return }
        let session = MovementSession(schema: "motorlab_movement_session_v1", id: id, startedAt: startedAt, endedAt: Date(), movementClass: .unknown, classSource: "unlabeled", labeledAt: nil, points: points)
        guard let data = try? JSONEncoder().encode(session) else { return }
        try? data.write(to: ridesDirectory.appendingPathComponent("session-\(id).json"), options: .atomic)
        try? FileManager.default.removeItem(at: ridesDirectory.appendingPathComponent("current.json"))
        lastSessionId = id
        lastSessionClass = .unknown
        UserDefaults.standard.set(id, forKey: "MotorLabLastMovementSessionId")
    }

    private func loadLastSessionSummary() {
        guard let id = UserDefaults.standard.string(forKey: "MotorLabLastMovementSessionId") else { return }
        let url = ridesDirectory.appendingPathComponent("session-\(id).json")
        guard let data = try? Data(contentsOf: url), let session = try? JSONDecoder().decode(MovementSession.self, from: data) else { return }
        lastSessionId = session.id
        lastSessionClass = session.movementClass
    }
}

extension Notification.Name {
    static let motorLabRideStarted = Notification.Name("MotorLabRideStarted")
    static let motorLabRideStopped = Notification.Name("MotorLabRideStopped")
}
