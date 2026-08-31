import SwiftUI

struct ContentView: View {
    @StateObject private var ride = AutoRideManager.shared

    var body: some View {
        VStack(spacing: 18) {
            Text("VÄNÄ MotorLab").font(.largeTitle.bold())
            Text("AUTO RIDE").font(.headline)
            Text(ride.status).font(.title3.bold())

            if ride.rideActive {
                Text("GPS/IMU-pisteitä \(ride.pointCount)")
                Text(String(format: "IMU %.3f g", ride.motionMagnitude))
                    .font(.footnote.monospacedDigit())
            }

            if ride.lastSessionId != nil && !ride.rideActive {
                VStack(spacing: 10) {
                    Text("Edellinen sessio: \(ride.lastSessionClass.rawValue)")
                        .font(.headline)
                    Text("Mikä liikkumistapa tämä oli?")
                        .font(.footnote)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: 8) {
                        ForEach(MovementClass.allCases.filter { $0 != .unknown }) { movementClass in
                            Button(movementClass.rawValue) {
                                ride.labelLastSession(movementClass)
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                    Button("UNKNOWN") { ride.labelLastSession(.unknown) }
                        .buttonStyle(.borderless)
                }
                .padding(.top, 8)
            }

            Text("MotorLab tallentaa GPS- ja IMU-liikedatan ensin UNKNOWN-luokkaan. Session voi merkitä jälkikäteen MOTO-, BUS-, CAR-, WALK- tai STATIONARY-luokkaan. Ääni ei vaikuta liikkumistavan tunnistukseen.")
                .font(.footnote)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .task { ride.start() }
    }
}
