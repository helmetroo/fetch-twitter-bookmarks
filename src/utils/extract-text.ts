const extractText = (blocks: Element[]) =>
    blocks.map(
        (block: Element) => {
            const textBlock = <HTMLElement> block;

            const text = textBlock.textContent;
            if(!text) {
                const emojiTextDiv = textBlock.querySelector('div');
                if(!emojiTextDiv)
                    return '';

                const emojiText = emojiTextDiv.getAttribute('aria-label') || '';
                return emojiText;
            }

            return text;
        }
    );

export default extractText;
