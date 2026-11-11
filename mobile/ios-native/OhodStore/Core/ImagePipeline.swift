import UIKit
import ImageIO

/// تحميل الصور بدون تقطيع: ذاكرة على القرص، تصغير بـ ImageIO لمقاس الكرت خارج الـ main thread، وذاكرة سريعة
final class ImagePipeline: @unchecked Sendable {
    static let shared = ImagePipeline()

    private let memory = NSCache<NSString, UIImage>()
    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(memoryCapacity: 16 << 20, diskCapacity: 400 << 20)
        config.requestCachePolicy = .returnCacheDataElseLoad
        config.timeoutIntervalForRequest = 20
        config.httpMaximumConnectionsPerHost = 6
        session = URLSession(configuration: config)
        memory.totalCostLimit = 120 << 20
    }

    private func key(_ url: URL, _ maxPixel: Int) -> NSString { "\(maxPixel)|\(url.absoluteString)" as NSString }

    func cached(_ url: URL, maxPixel: Int) -> UIImage? { memory.object(forKey: key(url, maxPixel)) }

    func image(_ url: URL, maxPixel: Int) async -> UIImage? {
        let k = key(url, maxPixel)
        if let hit = memory.object(forKey: k) { return hit }
        guard let result = try? await session.data(from: url),
              (result.1 as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true else { return nil }
        let data = result.0
        let decoded = await Task.detached(priority: .userInitiated) { ImagePipeline.downsample(data, maxPixel: maxPixel) }.value
        if let decoded {
            let cost = Int(decoded.size.width * decoded.size.height * decoded.scale * decoded.scale * 4)
            memory.setObject(decoded, forKey: k, cost: cost)
        }
        return decoded
    }

    static func downsample(_ data: Data, maxPixel: Int) -> UIImage? {
        let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithData(data as CFData, sourceOptions) else { return nil }
        let options = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ] as [CFString: Any] as CFDictionary
        guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else { return nil }
        return UIImage(cgImage: cg)
    }
}
