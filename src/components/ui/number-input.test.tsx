import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it} from 'vitest';
import {NumberInput} from './number-input';

afterEach(cleanup);

describe('NumberInput',()=>{
  it('groups digits while typing and submits the raw value',async()=>{
    const user=userEvent.setup();
    render(<form><NumberInput label="Price" name="price"/><button type="submit">Save</button></form>);
    const input=screen.getByLabelText('Price');
    await user.type(input,'1250000');
    expect(input).toHaveValue('1.250.000');
    expect(document.querySelector<HTMLInputElement>('input[type=hidden][name=price]')!.value).toBe('1250000');
  });

  it('keeps a decimal comma and caps fraction digits',async()=>{
    const user=userEvent.setup();
    render(<NumberInput label="Quantity" decimals={2}/>);
    const input=screen.getByLabelText('Quantity');
    await user.type(input,'1234,567');
    expect(input).toHaveValue('1.234,56');
  });

  it('clears the visible text when the form resets',async()=>{
    const user=userEvent.setup();
    render(<form><NumberInput label="Capacity" name="capacity"/><button type="reset">Reset</button></form>);
    const input=screen.getByLabelText('Capacity');
    await user.type(input,'1234');
    expect(input).toHaveValue('1.234');
    await user.click(screen.getByRole('button',{name:'Reset'}));
    expect(input).toHaveValue('');
    expect(document.querySelector<HTMLInputElement>('input[type=hidden][name=capacity]')!.value).toBe('');
  });
});
