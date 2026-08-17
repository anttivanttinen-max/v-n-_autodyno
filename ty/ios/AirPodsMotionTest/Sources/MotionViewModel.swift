import Foundation
import CoreMotion

@MainActor
final class MotionViewModel: ObservableObject {
    @Published var available = false
    @Published var checked = false
    @Published var active = false
    @Published var authorization = "UNKNOWN"
    @Published var status = "Yhdistä AirPods ja paina tarkistusta."

    @Published var userX = 0.0
    @Published var userY = 0.0
    @Published var userZ = 0.0
    @Published var gravityX = 0.0
    @Published var gravityY = 0.0
    @Published var gravityZ = 0.0
    @Published var rotationX = 0.0
    @Published var rotationY = 0.0
    @Published var rotationZ = 0.0
    @Published var roll = 0.0
    @Published var pitch = 0.0
    @Published var yaw = 0.0

    private let manager = CMHeadphoneMotionManager()
    private let queue: OperationQueue = {
        let q = OperationQueue()
        q.name = "fi.vana.motolab.headphone-motion"
        q.qualityOfService = .userInteractive
        q.maxConcurrentOperationCount = 1
        return q
    }()

    init() {
        refreshAuthorization()
    }

    func checkAvailability() {
        refreshAuthorization()
        checked = true
        available = manager.isDeviceMotionAvailable
        active = manager.isDeviceMotionActive
        status = available
            ? "YES — iOS tarjoaa headphone motion -datan tälle yhdistetylle kuulokkeelle."
            : "NO — iOS ei tarjoa headphone motion -dataa tällä kuulokkeella / yhteydellä."
    }

    func start() {
        checkAvailability()
        guard available else { return }

        manager.startDeviceMotionUpdates(to: queue) { [weak self] motion, error in
            guard let self else { return }
            if let error {
                Task { @MainActor in
                    self.active = false
                    self.status = "Motion-virhe: \(error.localizedDescription)"
                    self.refreshAuthorization()
                }
                return
            }
            guard let motion else { return }
            Task { @MainActor in
                self.active = self.manager.isDeviceMotionActive
                self.userX = motion.userAcceleration.x
                self.userY = motion.userAcceleration.y
                self.userZ = motion.userAcceleration.z
                self.gravityX = motion.gravity.x
                self.gravityY = motion.gravity.y
                self.gravityZ = motion.gravity.z
                self.rotationX = motion.rotationRate.x
                self.rotationY = motion.rotationRate.y
                self.rotationZ = motion.rotationRate.z
                self.roll = motion.attitude.roll
                self.pitch = motion.attitude.pitch
                self.yaw = motion.attitude.yaw
                self.status = "MOTION AKTIIVINEN — arvot päivittyvät livenä."
                self.refreshAuthorization()
            }
        }

        active = manager.isDeviceMotionActive
        refreshAuthorization()
    }

    func stop() {
        manager.stopDeviceMotionUpdates()
        active = false
        status = available ? "Motion pysäytetty." : status
    }

    private func refreshAuthorization() {
        switch CMHeadphoneMotionManager.authorizationStatus() {
        case .notDetermined: authorization = "NOT DETERMINED"
        case .restricted: authorization = "RESTRICTED"
        case .denied: authorization = "DENIED"
        case .authorized: authorization = "AUTHORIZED"
        @unknown default: authorization = "UNKNOWN"
        }
    }
}
