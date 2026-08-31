import SwiftUI

struct ContentView: View {
    @StateObject private var ride = AutoRideManager.shared

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Text("VÄNÄ MotorLab").font(.largeTitle.bold())
                Text("AUTO RIDE").font(.headline)
                Text(ride.status).font(.title3.bold())

                if ride.rideActive {
                    Text("GPS-pisteitä \(ride.pointCount) • IMU-näytteitä \(ride.imuSampleCount)")
                    Text(String(format: "IMU %.3f g", ride.motionMagnitude))
                        .font(.footnote.monospacedDigit())
                }

                if ride.lastSessionId != nil && !ride.rideActive {
                    VStack(spacing: 10) {
                        Text("Edellinen sessio: \(ride.lastSessionClass.rawValue)").font(.headline)
                        if let f = ride.lastSessionFeatures {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(String(format: "Kesto %.0f s • GPS-pisteitä %d", f.durationSec, f.pointCount))
                                if let imuCount = f.imuSampleCount { Text("IMU-näytteitä \(imuCount)") }
                                Text(String(format: "Nopeus ka %.1f • p90 %.1f • max %.1f km/h", f.meanSpeedKmh, f.p90SpeedKmh, f.maxSpeedKmh))
                                Text(String(format: "IMU ka %.3f g • p90 %.3f • p99 %.3f", f.accelMeanG, f.accelP90G, f.accelP99G))
                                Text(String(format: "Rotaatio ka %.3f • p90 %.3f rad/s", f.rotationMeanRadS, f.rotationP90RadS))
                                Text("Pysähdyksiä \(f.stopCount) • kovat kiihdytykset \(f.hardAccelEvents) • jarrutukset \(f.hardBrakeEvents)")
                            }
                            .font(.caption.monospacedDigit())
                        }

                        if !ride.lastSessionMatches.isEmpty {
                            VStack(alignment: .leading, spacing: 5) {
                                Text("Lähimmät aiemmat liikkumisluokat").font(.footnote.bold())
                                ForEach(Array(ride.lastSessionMatches.prefix(3))) { match in
                                    Text(String(format: "%@ • vertailu %.0f%% • etäisyys %.2f • %d näytettä",
                                                match.movementClass.rawValue,
                                                match.confidence * 100,
                                                match.distance,
                                                match.trainingSamples))
                                }
                                Text("Vertailu on oppimisen apu, ei vielä automaattinen MOTO-päätös.")
                                    .foregroundStyle(.secondary)
                            }
                            .font(.caption.monospacedDigit())
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        if !ride.movementFingerprints.isEmpty {
                            Text("Opetusdata: " + ride.movementFingerprints.map { "\($0.movementClass.rawValue) \($0.sampleCount)" }.joined(separator: " • "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Text("Mikä liikkumistapa tämä oli?").font(.footnote)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: 8) {
                            ForEach(MovementClass.allCases.filter { $0 != .unknown }) { movementClass in
                                Button(movementClass.rawValue) { ride.labelLastSession(movementClass) }
                                    .buttonStyle(.bordered)
                            }
                        }
                        Button("UNKNOWN") { ride.labelLastSession(.unknown) }.buttonStyle(.borderless)
                    }
                    .padding(.top, 8)
                }

                Text("MotorLab tallentaa GPS-datan ja erillisen nopean IMU-näytevirran ensin UNKNOWN-luokkaan ja vertaa sessiota aiemmin merkittyihin MOTO-, BUS-, CAR-, WALK- ja STATIONARY-näytteisiin. Luokka voidaan merkitä jälkikäteen ilman raakadatamuutoksia. Ääni ei vaikuta liikkumistavan tunnistukseen.")
                    .font(.footnote).multilineTextAlignment(.center)
            }
            .padding(24)
        }
        .task { ride.start() }
    }
}
