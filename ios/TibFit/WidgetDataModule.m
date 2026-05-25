#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetDataModule, NSObject)
RCT_EXTERN_METHOD(setSessionData:(NSString *)json)
@end
