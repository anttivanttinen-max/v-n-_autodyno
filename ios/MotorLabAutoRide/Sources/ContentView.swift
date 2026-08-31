import SwiftUI

struct ContentView: View {
    @StateObject private var ride = AutoRideManager.shared

    var body: some View {
        VStack(spacing: 18) {
            Text("VÄNÄ MotorLab").font(.largeTitle.bold())
            Text("AUTO RIDE").font(.headline)
            Text(ride.status).font(.title3.bold())
            if ride.rideActive {
                Text("GPS-pisteitä \(ride.pointCount)")
            }
            Text("Kun sijaintilupa on Aina, MotorLab voi tunnistaa liikkeellelähdön taustalla ja aloittaa ajon GPS-tallennuksen ilman ARM-painallusta.")
                .font(.footnote).multilineTextAlignment(.center)
        }
        .padding(24)
        .task { ride.start() }
    }
}
