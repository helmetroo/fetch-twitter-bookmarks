import { Substitute } from '@fluffy-spoon/substitute';
import { Page } from 'puppeteer';

const TestableBookmarksPage = Substitute.for<Page>();
export default TestableBookmarksPage;
