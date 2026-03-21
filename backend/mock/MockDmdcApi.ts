export class MockDmdcApi {
  async getMock() {
    return { mock: true, source: 'MockDmdcApi.ts' };
  }
}
