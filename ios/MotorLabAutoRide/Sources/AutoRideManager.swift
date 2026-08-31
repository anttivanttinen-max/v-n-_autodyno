import Foundation
import CoreLocation
import Combine

struct RidePoint: Codable {
    let timestamp: Date
    let latitude: Double
    let longitude: Double
    let speedKmh: Double
    let accuracyM: Double
}

@MainActor
final class AutoRideManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = AutoRideManager()

    @Published private(set) var status = "Valmis"
    @Published private(set) var rideActive = false
    @Published private(set) var pointCount = 0

    private let manager = CLLocationManager()
    private var movingHits = 0
    private var stoppedSince: Date?
    private var points: [RidePoint] = []
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

    private func configureStandby() {
        // Keep a low-power continuous location session alive so ride detection does not depend
        // only on significant-change delivery latency. iOS still controls actual fix cadence.
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
        manager.startMonitoringSignificantLocationChanges() // fallback relaunch path
        manager.startUpdatingLocation()                     // low-power fast detection path
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for location in locations where location.horizontalAccuracy >= 0 {
            consume(location)
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        status = "GPS: \(error.localizedDescription)"
    }

    private func consume(_ location: CLLocation) {
        let speed = max(0, location.speed * 3.6)

        if !rideActive {
            if speed >= startSpeedKmh && location.horizontalAccuracy <= 75 {
                movingHits += 1
            } else {
                movingHits = max(0, movingHits - 1)
            }
            if movingHits >= requiredMovingHits { beginRide(at: location) }
            return
        }

        append(location)
        if speed < 2 {
            if stoppedSince == nil { stoppedSince = location.timestamp }
            if let stoppedSince, location.timestamp.timeIntervalSince(stoppedSince) >= stopDelay {
                finishRide()
            }
        } else {
            stoppedSince = nil
        }
    }

    private func beginRide(at location: CLLocation) {
        rideActive = true
        movingHits = 0
        stoppedSince = nil
        points = []
        configureRideTracking()
        manager.startUpdatingLocation()
        append(location)
        status = "AJO TALLENTUU"
        NotificationCenter.default.post(name: .motorLabRideStarted, object: nil)
    }

    private func append(_ location: CLLocation) {
        points.append(RidePoint(timestamp: location.timestamp,
                                latitude: location.coordinate.latitude,
                                longitude: location.coordinate.longitude,
                                speedKmh: max(0, location.speed * 3.6),
                                accuracyM: location.horizontalAccuracy))
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
        armStandby()
        status = "Auto Ride valmiina"
        NotificationCenter.default.post(name: .motorLabRideStopped, object: nil)
    }

    private var ridesDirectory: URL {
        let base = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("MotorLabAutoRides", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private func persistCurrentRide() {
        guard let data = try? JSONEncoder().encode(points) else { return }
        try? data.write(to: ridesDirectory.appendingPathComponent("current.json"), options: .atomic)
    }

    private func persistCompletedRide() {
        guard !points.isEmpty, let data = try? JSONEncoder().encode(points) else { return }
        let name = "ride-\(Int(Date().timeIntervalSince1970)).json"
        try? data.write(to: ridesDirectory.appendingPathComponent(name), options: .atomic)
        try? FileManager.default.removeItem(at: ridesDirectory.appendingPathComponent("current.json"))
    }
}

extension Notification.Name {
    static let motorLabRideStarted = Notification.Name("MotorLabRideStarted")
    static let motorLabRideStopped = Notification.Name("MotorLabRideStopped")
}
