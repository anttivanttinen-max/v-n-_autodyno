import SwiftUI

struct ContentView: View {
    @StateObject private var vm = MotionViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("VÄNÄ MOTOLAB")
                    .font(.system(size: 30, weight: .black, design: .rounded))
                Text("AIRPODS MOTION TEST")
                    .font(.headline)

                VStack(alignment: .leading, spacing: 8) {
                    row("AVAILABLE", vm.checked ? (vm.available ? "YES" : "NO") : "—")
                    row("ACTIVE", vm.active ? "YES" : "NO")
                    row("AUTH", vm.authorization)
                    Text(vm.status)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))

                Button("TARKISTA AIRPODS MOTION") { vm.checkAvailability() }
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)

                HStack {
                    Button("KÄYNNISTÄ MOTION") { vm.start() }
                        .buttonStyle(.borderedProminent)
                        .disabled(!vm.available)
                    Button("STOP") { vm.stop() }
                        .buttonStyle(.bordered)
                }

                sensorCard("USER ACCELERATION (g)", x: vm.userX, y: vm.userY, z: vm.userZ)
                sensorCard("GRAVITY (g)", x: vm.gravityX, y: vm.gravityY, z: vm.gravityZ)
                sensorCard("ROTATION RATE (rad/s)", x: vm.rotationX, y: vm.rotationY, z: vm.rotationZ)
                sensorCard("ATTITUDE (rad)", x: vm.roll, y: vm.pitch, z: vm.yaw, labels: ("ROLL", "PITCH", "YAW"))

                Text("Testi ei tallenna eikä lähetä dataa. Jos AVAILABLE = NO, juuri tämä kuuloke/yhteys ei tarjoa CMHeadphoneMotionManager-dataa iOS:lle.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 6)
            }
            .padding()
        }
    }

    private func row(_ key: String, _ value: String) -> some View {
        HStack {
            Text(key).font(.caption.bold())
            Spacer()
            Text(value).font(.system(.body, design: .monospaced).bold())
        }
    }

    private func sensorCard(_ title: String, x: Double, y: Double, z: Double, labels: (String, String, String) = ("X", "Y", "Z")) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.caption.bold())
            valueLine(labels.0, x)
            valueLine(labels.1, y)
            valueLine(labels.2, z)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    private func valueLine(_ name: String, _ value: Double) -> some View {
        HStack {
            Text(name)
            Spacer()
            Text(String(format: "% .5f", value))
                .font(.system(.body, design: .monospaced))
        }
    }
}
